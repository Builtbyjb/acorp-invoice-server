import { MiddlewareHandler } from "hono";
import type { ENV } from "@/lib/types";

export default function rateLimiterMiddleware(): MiddlewareHandler<{ Bindings: ENV }> {
    return async (c, next) => {
        // Identify the request by IP or use a global key if not available
        const identifier = c.req.header("CF-Connecting-IP") ?? "global";
        const { success } = await c.env.RATE_LIMITER.limit({ key: identifier });
        if (!success) return c.json({ message: "Too many requests" }, 429);
        await next();
    };
}
