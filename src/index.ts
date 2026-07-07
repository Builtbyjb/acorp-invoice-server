import { Hono } from "hono";
import { cors } from "hono/cors";
import { ENV } from "./lib/types";
import { invoiceNotify, payout } from "./lib/crons";
import rateLimiterMiddleware from "./middleware/rate-limiter";

/* Shared routes */
import authRouteV1 from "./api/v1/auth/auth-controller";

/* App routes */
import invoiceRouteV1 from "./api/v1/invoice";
import opencommsRouteV1 from "./api/v1/opencomms";

import { INTERNAL_ERROR_MESSAGE } from "./lib/constants";

const app = new Hono<{ Bindings: ENV }>();

app.use(
    "/api/*",
    cors({
        origin: [
            "http://localhost:5173",
            "https://invoice.acorp.app",
            "https://app.acorp.insights",
            "https://app.acorp.invoice",
            "https://app.acorp.lumina",
            "https://app.acorp.opencomms",
            "https://app.acorp.traqr",
            "https://app.acorp.zendo",
        ],
        allowHeaders: [
            "X-Custom-Header",
            "Upgrade-Insecure-Requests",
            "Content-Type",
            "Authorization",
            "Set-Cookie",
            "X-Mobile-Client",
        ],
        allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PATCH", "PUT"],
        exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
        credentials: true,
    }),
);

app.use("/api/*", rateLimiterMiddleware());

app.onError((error, c) => {
    console.error(`${error.message}: ${error.stack}: ${error.cause}`);
    return c.json({ message: INTERNAL_ERROR_MESSAGE }, 500);
});

/* Register routes */
app.route("/api/v1", authRouteV1);
app.route("/api/v1", invoiceRouteV1);
app.route("/api/v1", opencommsRouteV1);

export default {
    fetch: app.fetch,

    async scheduled(event: ScheduledEvent, env: ENV, ctx: ExecutionContext) {
        if (event.cron === "* * * * *") {
            ctx.waitUntil(invoiceNotify(env));
            return;
        }

        if (event.cron === "0 0 1 * *") {
            ctx.waitUntil(payout(env));
        }
    },
};
