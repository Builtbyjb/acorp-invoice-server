import { Hono } from "hono";
import type { ENV, TokenPayload } from "@/lib/types/shared-types";
import type { Invoice } from "@/lib/types/invoice-types";
import { zValidator } from "@hono/zod-validator";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { InvoiceFormSchema } from "@/lib/zod-schema/invoice-zod-schema";
import planAccessMiddleware from "@/middleware/plan-access";
import authMiddleware from "@/middleware/authentication";
import { handleZodValidate } from "@/lib/utils";
import {
    getOrganizationMember,
    fetchOrgInvoicesPage,
    getClientInvoices,
    getInvoiceById,
    createInvoiceRecord,
    updateInvoiceRecord,
    softDeleteInvoice,
} from "./service";
import { InvoiceQuerySchema } from "@/lib/zod-schema/invoice-zod-schema";

const invoiceRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/invoices");

invoiceRouteV1.use("*", authMiddleware());

// Get all invoices for an organization
invoiceRouteV1.get(
    "/",
    zValidator("query", InvoiceQuerySchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const db = c.get("db");
        const jwtPayload = c.get("jwtPayload");
        const query = c.req.valid("query");

        let invoices: Invoice[] = [];

        if (query.clientId && !query.invoiceId) {
            invoices = await getClientInvoices(db, query.clientId);
        } else if (!query.clientId && !query.invoiceId) {
            const member = await getOrganizationMember(db, jwtPayload.userId);
            if (member.length == 0) return c.json("User is not part of an organization", 400);

            const pageStr = c.req.query("page");
            const sizeStr = c.req.query("size");

            let page = parseInt(pageStr ?? "1", 10);
            if (Number.isNaN(page) || page < 1) page = 1;

            let size = parseInt(sizeStr ?? "10", 10);
            if (Number.isNaN(size) || size < 1) size = 10;

            const MAX_SIZE = 100;
            size = Math.min(size, MAX_SIZE);

            // const total = await countOrgInvoices(db, member[0].organizationId);
            invoices = await fetchOrgInvoicesPage(db, member[0].organizationId, page, size);
        }

        return c.json(
            {
                message: "Invoices fetched",
                invoices: invoices,
                // meta: {
                //     total,
                //     page,
                //     size,
                //     totalPages: Math.ceil(total / size),
                // },
            },
            200,
        );
    },
);

// Get a single invoice
invoiceRouteV1.get("/:invoiceID", async (c) => {
    const db = c.get("db");
    const id = c.req.param("invoiceID");

    const invoice = await getInvoiceById(db, id);
    if (!invoice) return c.json({ message: "Invoice not found" }, 404);

    return c.json({ message: "Invoice fetched successfully", invoice }, 200);
});

invoiceRouteV1.post(
    "/create",
    planAccessMiddleware(),
    zValidator("json", InvoiceFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const db = c.get("db");
        const data = c.req.valid("json");
        const jwtPayload = c.get("jwtPayload");

        if (!data.clientID) return c.json({ message: "Client ID is required" }, 400);

        const result = await createInvoiceRecord(db, data, jwtPayload);
        if (!result) return c.json({ message: "Organization not found" }, 404);

        return c.json({ message: "Invoice created", data: result.invoiceId }, 200);
    },
);

invoiceRouteV1.put(
    "/:invoiceID/edit",
    zValidator("json", InvoiceFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const invoiceId = c.req.param("invoiceID");
        const db = c.get("db");
        const data = c.req.valid("json");

        await updateInvoiceRecord(db, invoiceId, data);

        return c.json({ message: "Invoice Updated", data: { id: invoiceId } }, 200);
    },
);

invoiceRouteV1.delete("/:invoiceID/delete", async (c) => {
    const invoiceId = c.req.param("invoiceID");
    const db = c.get("db");

    await softDeleteInvoice(db, invoiceId);

    return c.json({ message: "Invoice deleted" }, 200);
});

export default invoiceRouteV1;
