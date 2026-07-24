import { Hono } from "hono";
import type { ENV, TokenPayload, DashboardStats, MonthlyRevenue } from "@/lib/types";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, count, sql } from "drizzle-orm";
import { invoices } from "@/db/schema";
import { organizations, users } from "@/db/schema";
import { getMonthlyRevenues } from "./service";
import authMiddleware from "@/middleware/authentication";
import { zValidator } from "@hono/zod-validator";
import { getBlobURL, getCurrentYear, handleZodValidate } from "@/lib/utils";
import { UserSchema, BusinessSchema, FeedbackSchema, DashboardRevenueQuerySchema } from "@/lib/zod-schema";

const userRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/user");

userRouteV1.use("*", authMiddleware());

userRouteV1.get("/dashboard/stats", async (c) => {
    const db = c.get("db");
    const jwtPayload = c.get("jwtPayload");

    const data: DashboardStats = await db.transaction(async (tx) => {
        const baseFilters = and(eq(invoices.organizationId, jwtPayload.currentOrgId), eq(invoices.deleted, false));

        const [paidResult, sentResult, overdueResult, draftResult] = await Promise.all([
            tx
                .select({ count: count() })
                .from(invoices)
                .where(and(baseFilters, eq(invoices.status, "paid"))),
            tx
                .select({ count: count() })
                .from(invoices)
                .where(and(baseFilters, eq(invoices.status, "sent"))),
            tx
                .select({ count: count() })
                .from(invoices)
                .where(and(baseFilters, eq(invoices.status, "overdue"))),
            tx
                .select({ count: count() })
                .from(invoices)
                .where(and(baseFilters, eq(invoices.status, "draft"))),
        ]);

        return {
            paidCount: Number(paidResult[0].count),
            sentCount: Number(sentResult[0].count),
            overdueCount: Number(overdueResult[0].count),
            draftCount: Number(draftResult[0].count),
        };
    });

    console.log(data);

    return c.json({ message: "Success", data }, 200);
});

userRouteV1.get(
    "/dashboard/revenues",
    zValidator("query", DashboardRevenueQuerySchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const db = c.get("db");
        const jwtPayload = c.get("jwtPayload");
        const query = c.req.valid("query");

        const organization = await db
            .select({ currency: organizations.currency })
            .from(organizations)
            .where(eq(organizations.id, jwtPayload.currentOrgId))
            .then((result) => result[0]);

        if (!organization) return c.json({ message: "Organization not found" }, 404);

        const year = query.year ?? getCurrentYear();
        const currency = query.currency ?? organization.currency;

        if (!currency) return c.json({ message: "Currency is required" }, 400);

        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

        const paidInvoices = await db
            .select()
            .from(invoices)
            .where(
                and(
                    eq(invoices.organizationId, jwtPayload.currentOrgId),
                    eq(invoices.deleted, false),
                    eq(invoices.status, "paid"),
                    eq(invoices.currency, currency),
                    sql`${invoices.paymentDate} >= ${startOfYear} AND ${invoices.paymentDate} <= ${endOfYear}`,
                ),
            );

        const monthlyRevenues: MonthlyRevenue[] = getMonthlyRevenues(paidInvoices, year, currency);

        console.log(monthlyRevenues);

        return c.json({ message: "Success", data: { monthlyRevenues } }, 200);
    },
);

userRouteV1.get("/settings", async (c) => {
    const db = c.get("db");
    const jwtPayload = c.get("jwtPayload");

    const user = await db
        .select()
        .from(users)
        .where(eq(users.id, jwtPayload.userId))
        .then((result) => result[0]);
    if (!user) return c.json({ message: "User not found" }, 404);

    const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, jwtPayload.currentOrgId))
        .then((result) => result[0]);

    if (!organization) return c.json({ message: "User organization not found" }, 404);

    const setting = {
        user: {
            avatarURL: user.avatarURL,
            firstname: user.firstname,
        },
        business: {
            logoURL: organization.logoURL,
            name: organization.name,
            email: user.email,
            website: organization.website,
            address: organization.address,
            city: organization.city,
            country: organization.country,
        },
    };
    return c.json({ message: "Profile setting", data: setting }, 200);
});

userRouteV1.put(
    "/settings/profile",
    zValidator("form", UserSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("form");
        const db = c.get("db");

        const jwtPayload = c.get("jwtPayload");

        let blobURL: string | null = null;
        if (data.avatar) {
            const value = await c.env.R2.put(`${jwtPayload.userId}-avatar`, data.avatar, {
                httpMetadata: {
                    contentType: data.avatar.type,
                },
            });

            blobURL = getBlobURL(c, value?.key);
        }

        await db
            .update(users)
            .set({ avatarURL: blobURL || users.avatarURL, firstname: data.firstname })
            .where(eq(users.id, jwtPayload.userId));

        return c.json({ message: "User profile updated" }, 200);
    },
);

userRouteV1.put(
    "/settings/business",
    zValidator("form", BusinessSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("form");
        const db = c.get("db");

        const jwtPayload = c.get("jwtPayload");

        let blobURL: string | null = null;
        if (data.logo) {
            const value = await c.env.R2.put(`${jwtPayload.currentOrgId}-logo`, data.logo, {
                httpMetadata: {
                    contentType: data.logo.type,
                },
            });

            blobURL = getBlobURL(c, value?.key);
        }

        await db
            .update(organizations)
            .set({
                logoURL: blobURL || organizations.logoURL,
                name: data.name,
                address: data.address,
                city: data.city,
                country: data.country,
                website: data.website,
            })
            .where(eq(organizations.id, jwtPayload.currentOrgId));

        return c.json({ message: "Business Profile updated" }, 200);
    },
);

userRouteV1.post(
    "/settings/feedback",
    zValidator("json", FeedbackSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("json");

        await c.env.SEND_EMAIL.send({
            from: "feedback@acorp.app",
            to: "awotideajibola@gmail.com",
            subject: `Feedback from ACORP Invoice: ${data.subject}`,
            text: data.description,
        });

        return c.json({ message: "Feedback submitted" }, 200);
    },
);

export default userRouteV1;
