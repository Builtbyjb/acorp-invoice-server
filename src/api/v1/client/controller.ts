import { Hono } from "hono";
import type { ENV, TokenPayload } from "@/lib/types/shared-types";
import { zValidator } from "@hono/zod-validator";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ClientFormSchema, ClientQuerySchema } from "@/lib/zod-schema/client-zod-schema";
import authMiddleware from "@/middleware/authentication";
import { handleZodValidate } from "@/lib/utils";
import {
    fetchClientsPage,
    getClientById,
    fetchClientInvoicesPage,
    createClientRecord,
    softDeleteClient,
    updateClientRecord,
    searchClientsByName,
} from "./service";

const clientRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/clients");

clientRouteV1.use("*", authMiddleware());

clientRouteV1.get(
    "/",
    zValidator("query", ClientQuerySchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const db = c.get("db");
        const jwt = c.get("jwtPayload");
        const query = c.req.valid("query");

        const result = await fetchClientsPage(db, jwt.currentOrgId, query.page, query.size);

        return c.json(
            {
                message: "Clients fetched",
                clients: result.data,
                meta: result.meta,
            },
            200,
        );
    },
);

clientRouteV1.get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = c.get("db");

    const client = await getClientById(db, id);
    if (!client) return c.json({ message: "Client not found" }, 404);

    return c.json({ message: "Client fetched successfully", client }, 200);
});

// Get client invoices
clientRouteV1.get(
    "/:id/invoices",
    zValidator("query", ClientQuerySchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const db = c.get("db");
        const id = c.req.param("id");
        const query = c.req.valid("query");

        const result = await fetchClientInvoicesPage(db, id, query.page, query.size);

        return c.json(
            {
                message: "Client invoices fetched",
                invoices: result.data,
                meta: result.meta,
            },
            200,
        );
    },
);

clientRouteV1.post(
    "/create",
    zValidator("json", ClientFormSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("json");
        const db = c.get("db");
        const jwt = c.get("jwtPayload");

        const parsedClient = await createClientRecord(db, data, jwt.currentOrgId);

        return c.json({ message: "Client created", client: parsedClient }, 200);
    },
);

clientRouteV1.delete("/:id/delete", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    await softDeleteClient(db, id);

    return c.json({ message: "Client Deleted" }, 200);
});

clientRouteV1.put(
    "/:id/edit",
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

// TODO
clientRouteV1.post("/search", async (c) => {
    const db = c.get("db");
    const data = await c.req.json();
    const jwt = c.get("jwtPayload");

    const result = await searchClientsByName(db, jwt.currentOrgId, data.query);

    return c.json({ data: result }, 200);
});

export default clientRouteV1;
