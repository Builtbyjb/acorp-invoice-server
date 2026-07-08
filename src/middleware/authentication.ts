import { MiddlewareHandler } from "hono";
import type { TokenPayload, ENV } from "../lib/types";
import { getTokenFromCookieOrHeader } from "../lib/utils";
import { verify } from "hono/jwt";

export default function authMiddleware(): MiddlewareHandler<{
    Bindings: ENV;
    Variables: { jwtPayload: TokenPayload };
}> {
    return async (c, next) => {
        const token = getTokenFromCookieOrHeader(c, "refresh_token");
        if (!token) {
            console.log("refresh_token token not found");
            return c.json({ message: "Unauthorized: Refresh token not found" }, 401);
        }

        const secret = c.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT secret not configured");
            return c.json({ message: "Internal Server Error" }, 500);
        }

        try {
            const payload = await verify(token, secret, "HS256");
            c.set("jwtPayload", payload);
            await next();
        } catch (error) {
            console.log(error);
            return c.json({ message: "Unauthorized: Invalid token" }, 401);
        }
    };
}
