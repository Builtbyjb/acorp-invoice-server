import { MiddlewareHandler } from "hono";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { ENV } from "@/lib/types";

export default function injectDb(): MiddlewareHandler<{ Bindings: ENV; Variables: { db: NodePgDatabase } }> {
    return async (c, next) => {
        const connectionString = c.env.DB.connectionString;

        const client = new Client({ connectionString });
        await client.connect();

        const db = drizzle({ client });

        c.set("db", db);

        await next();

        c.executionCtx.waitUntil(client.end());
    };
}
