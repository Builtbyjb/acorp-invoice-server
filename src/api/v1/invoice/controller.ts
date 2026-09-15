import { Hono } from "hono";
import type { ENV, TokenPayload } from "@/lib/types/shared-types";
import type { FetchedInvoices, Invoice } from "@/lib/types/invoice-types";
import { zValidator } from "@hono/zod-validator";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { InvoiceFormSchema } from "@/lib/zod-schema/invoice-zod-schema";
import planAccessMiddleware from "@/middleware/plan-access";
import authMiddleware from "@/middleware/authentication";
import { handleZodValidate } from "@/lib/utils";
import {
    fetchOrgInvoicesPage,
    getInvoiceById,
    createInvoiceRecord,
    updateInvoiceRecord,
    softDeleteInvoice,
} from "./service";
import { InvoiceQuerySchema } from "@/lib/zod-schema/invoice-zod-schema";
import { fetchClientInvoicesPage } from "../client/service";

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
        const jwt = c.get("jwtPayload");
        const query = c.req.valid("query");

        let result: FetchedInvoices = {
            data: [],
            meta: {
                totalCount: 0,
                totalPages: 0,
                currentPage: 0,
                perPage: 0,
            },
        };

        if (query.clientID && !query.invoiceID) {
            result = await fetchClientInvoicesPage(db, query.clientID, query.page, query.size);
        } else if (!query.clientID && !query.invoiceID) {
            result = await fetchOrgInvoicesPage(db, jwt.currentOrgID, query.page, query.size);
        }

        return c.json(
            {
                message: "Invoices fetched",
                data: result.data,
                meta: result.meta,
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
        const jwt = c.get("jwtPayload") as TokenPayload;

        if (!data.clientID) return c.json({ message: "Client ID is required" }, 400);

        const result = await createInvoiceRecord(db, data, jwt.currentOrgID);
        if (!result) return c.json({ message: "Error creating invoice" }, 404);

        return c.json({ message: "Invoice created", data: result }, 200);
    },
);

invoiceRouteV1.put(
    "/:invoiceID/edit",
    zValidator("json", InvoiceFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const invoiceID = c.req.param("invoiceID");
        const db = c.get("db");
        const data = c.req.valid("json");

        const result = await updateInvoiceRecord(db, invoiceID, data);
        if (!result) return c.json({ message: "Error updating invoices" }, 400);

        return c.json({ message: "Invoice Updated", data: result }, 200);
    },
);

invoiceRouteV1.delete("/:invoiceID/delete", async (c) => {
    const invoiceID = c.req.param("invoiceID");
    const db = c.get("db");

    await softDeleteInvoice(db, invoiceID);

    return c.json({ message: "Invoice deleted" }, 200);
});

export default invoiceRouteV1;
