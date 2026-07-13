import { Hono } from "hono";
import type { ENV, TokenPayload } from "@/lib/types";
import { zValidator } from "@hono/zod-validator";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { InvoiceFormSchema } from "@/lib/zod-schema";
import planAccessMiddleware from "@/middleware/plan-access";
import authMiddleware from "@/middleware/authentication";
import { handleZodValidate } from "@/lib/utils";
import {
    getOrganizationMember,
    countOrgInvoices,
    fetchOrgInvoicesPage,
    getClientInvoices,
    getSingleInvoice,
    getClientRecord,
    getOrganizationById,
    createInvoiceRecord,
    updateInvoiceRecord,
    softDeleteInvoice,
} from "./service";

const invoiceRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/invoices");

invoiceRouteV1.use("*", authMiddleware());

invoiceRouteV1.get("/", async (c) => {
    const db = c.get("db");
    const jwtPayload = c.get("jwtPayload");

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

    const total = await countOrgInvoices(db, member[0].organizationId);
    const invoicesResult = await fetchOrgInvoicesPage(db, member[0].organizationId, page, size);

    return c.json(
        {
            message: "Invoices fetched",
            invoices: invoicesResult,
            meta: {
                total,
                page,
                size,
                totalPages: Math.ceil(total / size),
            },
        },
        200,
    );
});

invoiceRouteV1.get("/:clientId", async (c) => {
    const clientId = c.req.param("clientId");
    if (!clientId) return c.json({ message: "No client Id" }, 400);

    const db = c.get("db");

    const result = await getClientInvoices(db, clientId);

    return c.json({ message: "All Invoices", data: result }, 200);
});

invoiceRouteV1.get("/:clientId/:invoiceId", async (c) => {
    const clientId = c.req.param("clientId");
    if (!clientId) return c.json({ message: "No client Id" }, 400);

    const invoiceId = c.req.param("invoiceId");
    if (!invoiceId) return c.json({ message: "No invoice Id" }, 400);

    const jwt = c.get("jwtPayload");
    const db = c.get("db");

    const organization = await getOrganizationById(db, jwt.currentOrgId);
    if (!organization) return c.json({ message: "Organization not found" }, 404);

    const clientResult = await getClientRecord(db, clientId);
    if (!clientResult) return c.json({ message: "Client not found" }, 404);

    const invoiceResult = await getSingleInvoice(db, clientId, invoiceId);
    if (!invoiceResult) return c.json({ message: "Invoice not found" }, 404);

    return c.json({ invoice: invoiceResult, client: clientResult, logoURL: organization.logoURL }, 200);
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

        if (!data.clientId) return c.json({ message: "Client ID is required" }, 400);

        const result = await createInvoiceRecord(db, data, jwtPayload);
        if (!result) return c.json({ message: "Organization not found" }, 404);

        return c.json({ message: "Invoice created", data: result.invoiceId }, 200);
    },
);

invoiceRouteV1.put(
    "/:invoiceId/edit",
    zValidator("json", InvoiceFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const invoiceId = c.req.param("invoiceId");
        const db = c.get("db");
        const data = c.req.valid("json");

        await updateInvoiceRecord(db, invoiceId, data);

        return c.json({ message: "Invoice Updated", data: { id: invoiceId } }, 200);
    },
);

invoiceRouteV1.delete("/:invoiceId/delete", async (c) => {
    const invoiceId = c.req.param("invoiceId");
    const db = c.get("db");

    await softDeleteInvoice(db, invoiceId);

    return c.json({ message: "Invoice deleted" }, 200);
});

export default invoiceRouteV1;
