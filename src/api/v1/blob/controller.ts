import { Hono } from "hono";
import type { ENV, TokenPayload } from "../../../../lib/types";
import { authMiddleware } from "../../../../middleware/authentication";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

const blobRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/blobs");

blobRouteV1.use("*", authMiddleware());

blobRouteV1.get("/:key", async (c) => {
    const key = c.req.param("key");

    const object = await c.env.R2.get(key);

    if (!object) return c.json({ message: "File Not Found" }, 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Access-Control-Allow-Origin", "*");

    return c.body(object.body, 200, Object.fromEntries(headers as any));
});

export default blobRouteV1;
