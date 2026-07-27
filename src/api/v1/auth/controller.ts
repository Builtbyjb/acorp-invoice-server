import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ENV } from "@/lib/types";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { members, organizations, users } from "@/db/schema";
import { decodeTokenValue, signToken, sendOTPEmail, handleZodValidate, getTokenFromHeader } from "@/lib/utils";
import type { Country, TokenPayload, BaseTokenPayload } from "@/lib/types";
import { ErrorResult } from "@/lib/types";
import { getAccessTokenExp, getRefreshTokenExp } from "@/lib/constants";
import { signinSchema, otpSchema, signupSchema, refreshSchema } from "./zod-schema";
import { validateReferral, storeRefreshToken, getRefreshToken, deleteRefreshToken } from "./service";
import { COUNTRIES } from "@/lib/store/countries";

const authRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/auth");

authRouteV1.post(
    "/signin",
    zValidator("json", signinSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const { email } = c.req.valid("json");
        const db = c.get("db");

        const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .then((result) => result[0]);

        if (!user) {
            console.log("Error finding user");
            return c.json({ message: "User not found" }, 404);
        }

        const otp = await sendOTPEmail(c, email);
        if (otp instanceof Error) return c.json({ message: "Internal server error" }, 500);

        const payload: TokenPayload = {
            userId: user.id,
            email: user.email,
            firstname: user.firstname,
            currentOrgId: user.currentOrgId,
            otp: otp,
            exp: getAccessTokenExp(),
        };

        const signResult = await signToken(c, payload);
        if (signResult instanceof Error) return c.json({ message: signResult.message }, 500);

        return c.json({ message: "OTP sent to your email", accessToken: signResult }, 200);
    },
);

authRouteV1.post(
    "/signup",
    zValidator("json", signupSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("json");
        const db = c.get("db");

        console.log(data);

        let referredBy: number | null = null;
        if (data.referral) referredBy = await validateReferral(db, data.referral);

        // Check if user already exists
        const prevUser = await db.select().from(users).where(eq(users.email, data.email));
        if (prevUser.length > 0) return c.json({ message: "A user with this email address exists" }, 400);

        let organization: { id: number } | undefined;
        let user: { id: number; email: string; firstname: string } | undefined;
        let member: { id: number } | undefined;

        try {
            const country: Country | undefined = COUNTRIES.find((c) => c.name === data.country);

            // Create organization
            organization = await db
                .insert(organizations)
                .values({
                    name: data.businessName,
                    country: data.country,
                    currency: country?.currency,
                    referredBy,
                })
                .returning({ id: organizations.id })
                .then((result) => result[0]);

            if (!organization) throw new Error("Failed to create organization");

            // Create user
            user = await db
                .insert(users)
                .values({
                    email: data.email,
                    firstname: data.firstname,
                    lastname: data.lastname,
                    currentOrgId: organization.id,
                })
                .returning({ id: users.id, email: users.email, firstname: users.firstname })
                .then((result) => result[0]);

            if (!user) throw new Error("Failed to create user");

            // Create member
            member = await db
                .insert(members)
                .values({
                    userId: user.id,
                    organizationId: organization.id,
                    roleId: 1,
                })
                .returning({ id: members.id })
                .then((result) => result[0]);

            const otp = await sendOTPEmail(c, data.email);
            if (otp instanceof Error) return c.json({ message: "Internal server error" }, 500);

            const payload: TokenPayload = {
                userId: user.id,
                email: user.email,
                firstname: user.firstname,
                currentOrgId: organization.id,
                otp: otp,
                exp: getAccessTokenExp(),
            };

            const signResult = await signToken(c, payload);
            if (signResult instanceof Error) return c.json({ message: signResult.message }, 500);

            return c.json({ message: "Sign up completed", accessToken: signResult }, 200);
        } catch (error) {
            if (error instanceof DrizzleQueryError) {
                if (user?.id) await db.delete(users).where(eq(users.id, user.id));
                if (organization?.id) await db.delete(organizations).where(eq(organizations.id, organization.id));
                if (member?.id) await db.delete(members).where(eq(members.id, member.id));
            }

            throw error;
        }
    },
);

authRouteV1.post(
    "/verify-otp",
    zValidator("json", otpSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        // const db = c.get("db");
        const { code } = c.req.valid("json");

        if (!code) return c.json({ message: "OTP token not found" }, 400);
        const tempAccessToken = getTokenFromHeader(c);
        if (!tempAccessToken) return c.json({ message: "Access token not found" }, 401);

        const parsed = await decodeTokenValue(c, tempAccessToken);
        if (parsed instanceof ErrorResult) return c.json({ message: parsed.message }, parsed.code);

        if (!parsed.otp) return c.json({ message: "OTP not found" }, 400);
        if (parsed.otp !== code) return c.json({ message: "Invalid OTP" }, 400);

        const basePayload: BaseTokenPayload = {
            userId: parsed.userId,
            firstname: parsed.firstname,
            email: parsed.email,
            currentOrgId: parsed.currentOrgId,
        };

        const accessPayload: TokenPayload = {
            ...basePayload,
            exp: getAccessTokenExp(),
        };

        const accessToken = await signToken(c, accessPayload);
        if (accessToken instanceof Error) return c.json({ message: accessToken.message }, 500);

        const refreshPayload: TokenPayload = {
            ...basePayload,
            exp: getRefreshTokenExp(),
        };

        const refreshTokenId = crypto.randomUUID();
        const refreshToken = await signToken(c, refreshPayload);
        if (refreshToken instanceof Error) return c.json({ message: refreshToken.message }, 500);

        await storeRefreshToken(c, refreshTokenId, refreshToken);

        return c.json({ accessToken, refreshToken: refreshTokenId }, 200);
    },
);

authRouteV1.post(
    "/refresh-token",
    zValidator("json", refreshSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        // const db = c.get("db");

        const data = c.req.valid("json");

        const storedRefreshToken = await getRefreshToken(c, data.refreshTokenId);

        if (!storedRefreshToken) return c.json({ message: "Refresh token not found or expired" }, 401);

        const parsed = await decodeTokenValue(c, storedRefreshToken);
        if (parsed instanceof ErrorResult) return c.json({ message: parsed.message }, parsed.code);

        const basePayload: BaseTokenPayload = {
            userId: parsed.userId,
            firstname: parsed.firstname,
            email: parsed.email,
            currentOrgId: parsed.currentOrgId,
        };

        const accessPayload: TokenPayload = { ...basePayload, exp: getAccessTokenExp() };

        const accessToken = await signToken(c, accessPayload);
        if (accessToken instanceof Error) return c.json({ message: accessToken.message }, 500);

        const refreshPayload: TokenPayload = { ...basePayload, exp: getRefreshTokenExp() };

        await deleteRefreshToken(c, data.refreshTokenId);

        const refreshTokenId = crypto.randomUUID();
        const refreshToken = await signToken(c, refreshPayload);
        if (refreshToken instanceof Error) return c.json({ message: refreshToken.message }, 500);

        await storeRefreshToken(c, refreshTokenId, refreshToken);
        return c.json({ accessToken, refreshToken: refreshTokenId }, 200);
    },
);

authRouteV1.get("/signout", async (c) => {
    const refreshTokenId = getTokenFromHeader(c);
    if (refreshTokenId) await deleteRefreshToken(c, refreshTokenId);
    return c.json({ message: "Logged out" });
});

export default authRouteV1;
