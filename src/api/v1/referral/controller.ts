import { Hono } from "hono";
import type { ENV, TokenPayload } from "@/lib/types";
import authMiddleware from "@/middleware/authentication";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { organizations } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { handleZodValidate } from "@/lib/utils";
import { generateReferralCode, generateReferralLink, getSubscriptionAmount } from "./service";

const referralRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/referral");

referralRouteV1.use("*", authMiddleware());

const ReferralToggleSchema = z.object({
    referralEnabled: z.boolean(),
});

const PayoutMethodSchema = z.object({
    bankName: z.string().min(1),
    accountHolderName: z.string().min(1),
    accountNumber: z.string().min(1),
    routingNumber: z.string().optional(),
});

const REWARD = 0.05;

referralRouteV1.get("/details", async (c) => {
    const db = c.get("db");
    const jwt = c.get("jwtPayload");

    const organization = await db
        .select()
        .from(organizations)
        .where(and(eq(organizations.id, jwt.currentOrgId), eq(organizations.deleted, false)))
        .then((result) => result[0]);

    if (!organization) return c.json({ message: "Organization not found" }, 404);

    const referralLink = generateReferralLink(c.env.ENV, organization.referralCode);
    const currency = organization.currency || "NGN";
    const subAmount = getSubscriptionAmount(currency);

    const totalReferrals = await db.$count(
        organizations,
        and(eq(organizations.referredBy, organization.id), eq(organizations.deleted, false)),
    );

    const activeReferrals = await db.$count(
        organizations,
        and(eq(organizations.referredBy, organization.id), eq(organizations.deleted, false)),
    );

    const payout = activeReferrals * subAmount * REWARD;

    const data = {
        referralEnabled: organization.referralEnabled,
        referralLink,
        totalReferrals,
        activeReferrals,
        totalEarnings: organization.totalEarnings,
        payout,
        currency,
        payoutMethod: organization.referralPayoutMethod ? JSON.parse(organization.referralPayoutMethod) : null,
    };

    return c.json({ message: "Referral details fetched successfully", data }, 200);
});

referralRouteV1.post(
    "/toggle",
    zValidator("json", ReferralToggleSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const { referralEnabled } = c.req.valid("json");
        const db = c.get("db");
        const jwt = c.get("jwtPayload");

        if (referralEnabled) {
            const organization = await db
                .select()
                .from(organizations)
                .where(and(eq(organizations.id, jwt.currentOrgId), eq(organizations.deleted, false)))
                .then((result) => result[0]);

            if (!organization) return c.json({ message: "Organization not found" }, 404);

            if (!organization.referralCode) {
                const referralCode = generateReferralCode(organization.name);
                await db
                    .update(organizations)
                    .set({ referralCode })
                    .where(eq(organizations.id, jwt.currentOrgId))
                    .execute();
            }
        }

        await db
            .update(organizations)
            .set({ referralEnabled })
            .where(and(eq(organizations.id, jwt.currentOrgId), eq(organizations.deleted, false)))
            .execute();

        return c.json({ message: "Referral toggle updated successfully" }, 200);
    },
);

referralRouteV1.post(
    "/payout-method",
    zValidator("json", PayoutMethodSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("json");
        const db = c.get("db");
        const jwt = c.get("jwtPayload");

        await db
            .update(organizations)
            .set({
                referralPayoutMethod: JSON.stringify(data),
            })
            .where(eq(organizations.id, jwt.currentOrgId));

        return c.json({ message: "Payout method updated successfully" }, 200);
    },
);

export default referralRouteV1;
