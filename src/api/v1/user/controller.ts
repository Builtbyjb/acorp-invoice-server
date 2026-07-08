import { Hono } from "hono";
import type { ENV, Client, Invoice, TokenPayload } from "@/lib/types";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import { clients, invoices } from "@/db/schema";
import { organizations, users } from "@/db/schema";
import {
    countPaidInvoices,
    calculateRevenue,
    countPendingInvoices,
    getInvoiceData,
    getMonthlyRevenues,
    getRecentInvoices,
} from "./service";
import { authMiddleware } from "@/middleware/authentication";
import { zValidator } from "@hono/zod-validator";
import { getBlobURL, handleZodValidate } from "@/lib/utils";
import { UserSchema, BusinessSchema, FeedbackSchema } from "@/lib/zod-schema";

const userRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/user");

userRouteV1.use("*", authMiddleware());

userRouteV1.get("/dashboard", async (c) => {
    const db = c.get("db");
    const jwtPayload = c.get("jwtPayload");

    const allClients: Client[] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.organizationId, jwtPayload.currentOrgId), eq(clients.deleted, false)));

    if (allClients.length === 0) return c.json({ message: "No clients found" }, 404);

    const totalClients = allClients.length;

    const allInvoices: Invoice[] = [];

    for (const client of allClients) {
        const clientInvoices = await db
            .select()
            .from(invoices)
            .where(and(eq(invoices.clientId, client.id), eq(invoices.deleted, false)));

        allInvoices.push(...clientInvoices);
    }

    const totalRevenue: number = calculateRevenue(allInvoices);
    const paidInvoices = countPaidInvoices(allInvoices);
    const pendingInvoices = countPendingInvoices(allInvoices);
    const invoiceData = getInvoiceData(allInvoices);
    const monthlyRevenues = getMonthlyRevenues(allInvoices);
    const recentInvoices = getRecentInvoices(allInvoices);

    const data = {
        topStats: { totalRevenue, paidInvoices, pendingInvoices, totalClients },
        invoiceData,
        monthlyRevenues,
        recentInvoices,
    };

    return c.json({ message: "Success", data }, 200);
});

userRouteV1.get("/settings", async (c) => {
    const db = c.get("db");
    const jwtPayload = c.get("jwtPayload");

    const user = await db.select().from(users).where(eq(users.id, jwtPayload.userId)).get();
    if (!user) return c.json({ message: "User not found" }, 404);

    const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, jwtPayload.currentOrgId))
        .get();

    if (!organization) return c.json({ message: "User organization not found" }, 404);

    const setting = {
        user: {
            avatarURL: user.avatarURL,
            username: user.username,
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
            .set({ avatarURL: blobURL || users.avatarURL, username: data.username })
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
