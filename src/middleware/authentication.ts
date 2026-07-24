import { MiddlewareHandler } from "hono";
import type { TokenPayload, ENV } from "@/lib/types";
import { verify } from "hono/jwt";
import { getTokenFromHeader } from "@/lib/utils";

export default function authMiddleware(): MiddlewareHandler<{
    Bindings: ENV;
    Variables: { jwtPayload: TokenPayload };
}> {
    return async (c, next) => {
        const accessToken = getTokenFromHeader(c);
        if (!accessToken) return c.json({ message: "Unauthorized: Access token not found" }, 401);

        const secret = c.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT secret not configured");
            return c.json({ message: "Internal Server Error" }, 500);
        }

        try {
            const payload = (await verify(accessToken, secret, "HS256")) as TokenPayload;
            c.set("jwtPayload", payload);
            await next();
        } catch (error) {
            console.log(error);
            return c.json({ message: "Unauthorized: Invalid access token" }, 401);
        }
    };
}
