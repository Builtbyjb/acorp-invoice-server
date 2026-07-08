import { Hono } from "hono";
import type { ENV, TokenPayload } from "../../../../lib/types";
import { zValidator } from "@hono/zod-validator";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ClientFormSchema } from "../../../../lib/zod-schema";
import { authMiddleware } from "../../../../middleware/authentication";
import { handleZodValidate } from "../../../../lib/utils";
import {
    getOrganizationMember,
    countClients,
    fetchClientsPage,
    getClientById,
    countClientInvoices,
    fetchClientInvoicesPage,
    createClientRecord,
    softDeleteClient,
    updateClientRecord,
    searchClientsByName,
} from "./service";
import invoiceRoutes from "../invoice/controller";

const clientRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/clients");

clientRouteV1.use("*", authMiddleware());

clientRouteV1.get("/", async (c) => {
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

    const total = await countClients(db, member[0].organizationId);
    const parsedResult = await fetchClientsPage(db, member[0].organizationId, page, size);

    return c.json(
        {
            message: "Clients fetched",
            clients: parsedResult,
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

clientRouteV1.get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = c.get("db");

    const pageStr = c.req.query("page");
    const sizeStr = c.req.query("size");

    let page = parseInt(pageStr ?? "1", 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    let size = parseInt(sizeStr ?? "10", 10);
    if (Number.isNaN(size) || size < 1) size = 10;

    const MAX_SIZE = 100;
    size = Math.min(size, MAX_SIZE);

    const client = await getClientById(db, id);
    if (!client) return c.json("Client not found", 404);

    const total = await countClientInvoices(db, client.id);
    const invoicesResult = await fetchClientInvoicesPage(db, client.id, page, size);

    return c.json(
        {
            clientInfo: client,
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

clientRouteV1.post(
    "/create",
    zValidator("json", ClientFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("json");
        const db = c.get("db");
        const jwtPayload = c.get("jwtPayload");

        const member = await getOrganizationMember(db, jwtPayload.userId);
        if (member.length == 0) return c.json("User is not part of an organization", 400);

        const parsedClient = await createClientRecord(db, data, member[0].organizationId);

        return c.json({ message: "Client created", client: parsedClient }, 200);
    },
);

clientRouteV1.delete("/delete/:id", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    await softDeleteClient(db, id);

    return c.json({ message: "Client Deleted" }, 200);
});

clientRouteV1.put(
    "/edit/:id",
    zValidator("json", ClientFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const db = c.get("db");
        const data = c.req.valid("json");
        const id = c.req.param("id");

        await updateClientRecord(db, id, data);

        return c.json({ message: "Client data edited" }, 200);
    },
);

clientRouteV1.post("/search", async (c) => {
    const db = c.get("db");
    const data = await c.req.json();
    const jwtPayload = c.get("jwtPayload");

    const member = await getOrganizationMember(db, jwtPayload.userId);
    if (member.length == 0) return c.json("User is not part of an organization", 400);

    const result = await searchClientsByName(db, member[0].organizationId, data.query);

    return c.json({ data: result }, 200);
});

clientRouteV1.route("/:clientId", invoiceRoutes);

export default clientRouteV1;
