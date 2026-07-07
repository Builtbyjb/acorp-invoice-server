import { MiddlewareHandler } from "hono";
import type { TokenPayload, ENV } from "../lib/types";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { clients, invoices } from "../db/invoice-schema";
import { organizations } from "../db/schemas";
import { eq, and, sql } from "drizzle-orm";
import { getGateway } from "../lib/payment";

const MAX_INVOICE_COUNT = 5;

/* Checks if user has reached the maximum invoice count for the current month */
async function verifyInvoiceCount(db: DrizzleD1Database, orgId: number): Promise<boolean> {
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(
            and(
                eq(clients.organizationId, orgId),
                eq(clients.deleted, false),
                eq(invoices.deleted, false),
                sql`strftime('%Y-%m', ${invoices.createdAt}) = strftime('%Y-%m', 'now')`,
            ),
        )
        .get();

    return (result?.count ?? 0) <= MAX_INVOICE_COUNT;
}

export function planAccessMiddleware(): MiddlewareHandler<{
    Bindings: ENV;
    Variables: { jwtPayload: TokenPayload };
}> {
    return async (c, next) => {
        const db = drizzle(c.env.DB);
        const jwtPayload = c.get("jwtPayload") as TokenPayload;

        const organization = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, jwtPayload.currentOrgId))
            .get();

        if (!organization) return c.json({ message: "Organization not found" }, 404);

        const provider = (organization.paymentProvider || "paystack") as "paystack" | "stripe";
        const gateway = getGateway(provider, c.env);

        // Check local subscription status first
        const localStatus =
            provider === "paystack" ? organization.paystackSubscriptionStatus : organization.stripeSubscriptionStatus;

        if (localStatus === "active") {
            await next();
            return;
        }

        // Check with the gateway for active or non-renewing subscriptions
        const customerId = provider === "paystack" ? jwtPayload.paystackCustomerId : jwtPayload.stripeCustomerId;

        if (!customerId) {
            if (!(await verifyInvoiceCount(db, jwtPayload.currentOrgId)))
                return c.json({ message: "Subscription expired" }, 403);
            await next();
            return;
        }

        const hasActiveOrNonRenewing = await gateway.hasActiveSubscription(customerId);

        if (!hasActiveOrNonRenewing) {
            if (!(await verifyInvoiceCount(db, jwtPayload.currentOrgId)))
                return c.json({ message: "Subscription expired" }, 403);
        }

        await next();
    };
}
