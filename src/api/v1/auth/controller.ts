import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ENV } from "../../../lib/types";
import { drizzle } from "drizzle-orm/d1";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { members, organizations, users } from "../../../db/schemas";
import {
    parseToken,
    parseTokenValue,
    signToken,
    sendOTPEmail,
    handleZodValidate,
    getTokenFromCookieOrHeader,
} from "../../../lib/utils";
import { setCookie, deleteCookie } from "hono/cookie";
import type { TokenPayload } from "../../../lib/types";
import { ErrorResult } from "../../../lib/types";
import {
    getAccessTokenExp,
    ACCESS_TOKEN_MAX_AGE,
    getRefreshTokenExp,
    REFRESH_TOKEN_MAX_AGE,
} from "../../../lib/constants";
import { loginSchema, otpSchema, signupSchema } from "./zod-schema";
import { validateReferral } from "./service";
import { detectProvider, getGateway, getCurrency } from "../../../lib/payment";

function isMobileClient(c: Context): boolean {
    return c.req.header("X-Mobile-Client") === "true";
}

const authRouteV1 = new Hono<{ Bindings: ENV }>().basePath("/auth");

authRouteV1.post(
    "/login",
    zValidator("json", loginSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const { email } = c.req.valid("json");
        const db = drizzle(c.env.DB);

        const user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
            console.log("Error finding user");
            return c.json({ message: "User not found" }, 404);
        }

        const otp = await sendOTPEmail(c, email);
        if (otp instanceof Error) return c.json({ message: "Internal server error" }, 500);

        const payload: TokenPayload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            currentOrgId: user.currentOrgId,
            otp: otp,
            exp: getAccessTokenExp(),
        };

        const signResult = await signToken(c, payload);
        if (signResult instanceof Error) return c.json({ message: signResult.message }, 500);

        setCookie(c, "otp_token", signResult, {
            httpOnly: true,
            secure: true,
            sameSite: c.env.ENV === "dev" ? "none" : "lax",
            path: "/",
            maxAge: ACCESS_TOKEN_MAX_AGE,
        });

        const mobile = isMobileClient(c);
        return c.json({ message: "OTP sent to your email", ...(mobile ? { otpToken: signResult } : {}) }, 200);
    },
);

authRouteV1.post(
    "/signup",
    zValidator("json", signupSchema, (result, c) => {
        return handleZodValidate(result, c);
    }),
    async (c) => {
        const data = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // verify referral
        let referredBy: number | null = null;
        if (data.referral) referredBy = await validateReferral(db, data.referral);

        // Check if user exists
        const prevUser = await db.select().from(users).where(eq(users.email, data.email)).get();
        if (prevUser) return c.json({ message: "A user with this email address exists" }, 400);

        let organization: { id: number } | undefined;
        let user: { id: number; email: string; username: string } | undefined;
        let member: { id: number } | undefined;

        try {
            // Detect payment provider
            let provider: "paystack" | "stripe" | null = data.paymentProvider as "paystack" | "stripe" | null;
            if (!provider) {
                provider = detectProvider(data.country);
            }
            if (!provider) {
                return c.json({ message: "Unable to determine payment provider. Please select a provider." }, 400);
            }

            const currency = data.currency || getCurrency(provider);
            const gateway = getGateway(provider, c.env);

            // Create customer with the selected gateway
            const customer = await gateway.createCustomer(data.email, data.firstname, data.lastname);

            // Create organization
            organization = await db
                .insert(organizations)
                .values({
                    name: data.businessName,
                    type: data.businessType,
                    address: data.businessAddress,
                    city: data.city,
                    country: data.country,
                    website: data.website,
                    paymentProvider: provider,
                    currency,
                    referredBy,
                    paystackCustomerCode: provider === "paystack" ? customer.customerCode : null,
                    paystackCustomerId:
                        provider === "paystack" ? (typeof customer.id === "number" ? customer.id : null) : null,
                    stripeCustomerId: provider === "stripe" ? String(customer.id) : null,
                })
                .returning({ id: organizations.id })
                .get();

            // Create user
            user = await db
                .insert(users)
                .values({
                    email: data.email,
                    firstname: data.firstname,
                    lastname: data.lastname,
                    username: data.username,
                    currentOrgId: organization.id,
                })
                .returning()
                .get();

            // Create member
            member = await db
                .insert(members)
                .values({
                    userId: user.id,
                    organizationId: organization.id,
                    roleId: 1,
                })
                .returning({ id: members.id })
                .get();

            const otp = await sendOTPEmail(c, data.email);
            if (otp instanceof Error) return c.json({ message: "Internal server error" }, 500);

            const payload: TokenPayload = {
                userId: user.id,
                email: user.email,
                username: user.username,
                currentOrgId: organization.id,
                otp: otp,
                paymentProvider: provider,
                paystackCustomerCode: provider === "paystack" ? customer.customerCode : undefined,
                paystackCustomerId: provider === "paystack" ? Number(customer.id) : undefined,
                stripeCustomerId: provider === "stripe" ? String(customer.id) : undefined,
                exp: getAccessTokenExp(),
            };

            const signResult = await signToken(c, payload);
            if (signResult instanceof Error) return c.json({ message: signResult.message }, 500);

            setCookie(c, "otp_token", signResult, {
                httpOnly: true,
                secure: true,
                sameSite: c.env.ENV === "dev" ? "None" : "lax",
                path: "/",
                maxAge: ACCESS_TOKEN_MAX_AGE,
            });

            const mobile = isMobileClient(c);
            return c.json({ message: "Sign up completed", ...(mobile ? { otpToken: signResult } : {}) }, 200);
        } catch (error) {
            // Clean up on failure
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
        const db = drizzle(c.env.DB);
        const { otp, otpToken } = c.req.valid("json");

        const otpTokenValue =
            (isMobileClient(c) && otpToken ? otpToken : undefined) ?? getTokenFromCookieOrHeader(c, "otp_token");
        if (!otpTokenValue) {
            return c.json({ message: "OTP token not found" }, 401);
        }

        const parsed = await parseTokenValue(c, otpTokenValue);
        if (parsed instanceof ErrorResult) return c.json({ message: parsed.message }, parsed.code);

        // Verify OTP code
        if (!parsed.otp) return c.json({ message: "OTP not found" }, 400);
        if (parsed.otp !== otp) return c.json({ message: "Invalid OTP" }, 400);

        // Verify user exists
        const user = await db.select().from(users).where(eq(users.id, parsed.userId)).get();
        if (!user) return c.json({ message: "User not found" }, 404);

        // Get organization details
        const organization = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, parsed.currentOrgId))
            .get();
        if (!organization) return c.json({ message: "User organization not found" }, 404);

        const payload: TokenPayload = {
            userId: parsed.userId,
            username: user.username,
            email: user.email,
            currentOrgId: parsed.currentOrgId,
            organizationName: organization.name,
            paymentProvider: organization.paymentProvider || undefined,
            paystackCustomerCode: organization.paystackCustomerCode || undefined,
            paystackCustomerId: organization.paystackCustomerId || undefined,
            stripeCustomerId: organization.stripeCustomerId || undefined,
            exp: getRefreshTokenExp(),
        };

        const refreshToken = await signToken(c, payload);
        if (refreshToken instanceof Error) return c.json({ message: refreshToken.message }, 500);

        setCookie(c, "refresh_token", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: c.env.ENV === "dev" ? "none" : "lax",
            path: "/",
            maxAge: REFRESH_TOKEN_MAX_AGE,
        });

        const accessPayload: TokenPayload = {
            userId: parsed.userId,
            username: user.username,
            email: user.email,
            currentOrgId: parsed.currentOrgId,
            organizationName: organization.name,
            paymentProvider: organization.paymentProvider || undefined,
            paystackCustomerCode: organization.paystackCustomerCode || undefined,
            paystackCustomerId: organization.paystackCustomerId || undefined,
            stripeCustomerId: organization.stripeCustomerId || undefined,
            exp: getAccessTokenExp(),
        };

        const accessToken = await signToken(c, accessPayload);
        if (accessToken instanceof Error) c.json({ message: accessToken.message }, 500);

        const mobile = isMobileClient(c);
        return c.json(
            {
                accessToken: accessToken,
                user: {
                    username: user.username,
                    organizationName: organization.name,
                    email: user.email,
                },
                ...(mobile ? { refreshToken } : {}),
            },
            200,
        );
    },
);

authRouteV1.get("/refresh-token", async (c) => {
    const db = drizzle(c.env.DB);

    const parsed = await parseToken(c, "refresh_token");
    if (parsed instanceof ErrorResult) return c.json({ message: parsed.message }, parsed.code);

    // Get organization details
    const organization = await db.select().from(organizations).where(eq(organizations.id, parsed.currentOrgId)).get();
    if (!organization) return c.json({ message: "User organization not found" }, 404);

    const accessPayload: TokenPayload = {
        userId: parsed.userId,
        username: parsed.username,
        email: parsed.email,
        currentOrgId: parsed.currentOrgId,
        organizationName: organization.name,
        paymentProvider: organization.paymentProvider || undefined,
        paystackCustomerCode: parsed.paystackCustomerCode,
        paystackCustomerId: parsed.paystackCustomerId,
        stripeCustomerId: parsed.stripeCustomerId,
        exp: getAccessTokenExp(),
    };

    const accessToken = await signToken(c, accessPayload);
    if (accessToken instanceof Error) c.json({ message: accessToken.message }, 500);

    return c.json(
        {
            accessToken: accessToken,
            user: {
                username: parsed.username,
                organizationName: organization.name,
                email: parsed.email,
            },
        },
        200,
    );
});

authRouteV1.get("/logout", (c) => {
    deleteCookie(c, "refresh_token");
    return c.json({ message: "Logged out" });
});

export default authRouteV1;
