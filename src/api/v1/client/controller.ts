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
    findClientsByName,
} from "./service";
import { FetchedClients } from "@/lib/types/client-types";

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

        let result: FetchedClients = {
            data: [],
            meta: {
                totalCount: 0,
                totalPages: 0,
                currentPage: 0,
                perPage: 0,
            },
        };

        if (query.name) {
            result = await findClientsByName(
                db,
                jwt.currentOrgID,
                query.name,
                query.page,
                query.size,
            );
        } else {
            result = await fetchClientsPage(db, jwt.currentOrgID, query.page, query.size);
        }

        return c.json(
            {
                message: "Clients fetched",
                data: result.data,
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
                data: result.data,
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

        const result = await createClientRecord(db, data, jwt.currentOrgID);
        if (!result) return c.json({ message: "Failed to create client" }, 400);

        return c.json({ message: "Client created", data: result }, 200);
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

        // TODO
        const result = await updateClientRecord(db, id, data);
        if (!result) return c.json({ message: "Error updating client" }, 400);

        return c.json({ message: "Client data edited", data: result }, 200);
    },
);

export default clientRouteV1;
