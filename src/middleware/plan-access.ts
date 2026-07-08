import { MiddlewareHandler } from "hono";
import type { TokenPayload, ENV } from "../lib/types";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { clients, invoices } from "../db/schema";
import { organizations } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

const MAX_INVOICE_COUNT = 5;

/* Checks if user has reached the maximum invoice count for the current month */
async function verifyInvoiceCount(db: NodePgDatabase, orgId: number): Promise<boolean> {
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(
            and(
                eq(clients.organizationId, orgId),
                eq(clients.deleted, false),
                eq(invoices.deleted, false),
                sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`,
            ),
        )
        .get();

    return (result?.count ?? 0) <= MAX_INVOICE_COUNT;
}

export default function planAccessMiddleware(): MiddlewareHandler<{
    Bindings: ENV;
    Variables: { jwtPayload: TokenPayload; db: NodePgDatabase };
}> {
    return async (c, next) => {
        const db = c.get("db");
        const jwtPayload = c.get("jwtPayload");

        const organization = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, jwtPayload.currentOrgId))
            .get();

        if (!organization) return c.json({ message: "Organization not found" }, 404);

        const provider = (organization.paymentProvider || "paystack") as "paystack" | "stripe";

        const localStatus =
            provider === "paystack" ? organization.paystackSubscriptionStatus : organization.stripeSubscriptionStatus;

        if (localStatus === "active") {
            await next();
            return;
        }

        await next();
    };
}
