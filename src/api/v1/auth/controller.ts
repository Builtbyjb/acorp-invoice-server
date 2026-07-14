import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ENV } from "@/lib/types";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { members, organizations, users } from "@/db/schema";
import { parseToken, parseTokenValue, signToken, sendOTPEmail, handleZodValidate } from "@/lib/utils";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Country, TokenPayload } from "@/lib/types";
import { ErrorResult } from "@/lib/types";
import { getAccessTokenExp, ACCESS_TOKEN_MAX_AGE, getRefreshTokenExp, REFRESH_TOKEN_MAX_AGE } from "@/lib/constants";
import { loginSchema, otpSchema, signupSchema } from "./zod-schema";
import { validateReferral } from "./service";
import { COUNTRIES } from "@/lib/store/countries";

// function isMobileClient(c: Context): boolean {
//     return c.req.header("X-Mobile-Client") === "true";
// }

const authRouteV1 = new Hono<{
    Bindings: ENV;
    Variables: { db: NodePgDatabase; jwtPayload: TokenPayload };
}>().basePath("/auth");

authRouteV1.post(
    "/login",
    zValidator("json", loginSchema, (result, c) => {
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

        // setCookie(c, "otp_token", signResult, {V
        //     httpOnly: true,
        //     secure: true,
        //     sameSite: c.env.ENV === "dev" ? "none" : "lax",
        //     path: "/",
        //     maxAge: ACCESS_TOKEN_MAX_AGE,
        // });

        // const mobile = isMobileClient(c);
        return c.json({ message: "OTP sent to your email", otpToken: signResult }, 200);
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

        const prevUser = await db.select().from(users).where(eq(users.email, data.email));
        if (prevUser.length > 0) return c.json({ message: "A user with this email address exists" }, 400);

        let organization: { id: number } | undefined;
        let user: { id: number; email: string; firstname: string } | undefined;
        let member: { id: number } | undefined;

        try {
            const country: Country | undefined = COUNTRIES.find((c) => c.name === data.country);

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

            // setCookie(c, "otp_token", signResult, {
            //     httpOnly: true,
            //     secure: true,
            //     sameSite: c.env.ENV === "dev" ? "None" : "lax",
            //     path: "/",
            //     maxAge: ACCESS_TOKEN_MAX_AGE,
            // });

            // const mobile = isMobileClient(c);
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
        const db = c.get("db");
        const { otp } = c.req.valid("json");

        if (!otp) {
            return c.json({ message: "OTP token not found" }, 401);
        }

        const parsed = await parseTokenValue(c, otp);
        if (parsed instanceof ErrorResult) return c.json({ message: parsed.message }, parsed.code);

        if (!parsed.otp) return c.json({ message: "OTP not found" }, 400);
        if (parsed.otp !== otp) return c.json({ message: "Invalid OTP" }, 400);

        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, parsed.userId))
            .then((res) => res[0]);

        if (!user) return c.json({ message: "User not found" }, 404);

        const organization = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, parsed.currentOrgId))
            .then((res) => res[0]);

        if (!organization) return c.json({ message: "User organization not found" }, 404);

        const payload: TokenPayload = {
            userId: parsed.userId,
            firstname: user.firstname,
            email: user.email,
            currentOrgId: parsed.currentOrgId,
            organizationName: organization.name,
            exp: getRefreshTokenExp(),
        };

        const authToken = await signToken(c, payload);
        if (authToken instanceof Error) return c.json({ message: authToken.message }, 500);

        // const mobile = isMobileClient(c);
        return c.json(
            {
                user: {
                    firstname: user.firstname,
                    organizationName: organization.name,
                    email: user.email,
                },
                authToken,
            },
            200,
        );
    },
);

authRouteV1.get("/refresh-token", async (c) => {
    const db = c.get("db");

    const parsed = await parseToken(c, "refresh_token");
    if (parsed instanceof ErrorResult) return c.json({ message: parsed.message }, parsed.code);

    const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, parsed.currentOrgId))
        .then((res) => res[0]);

    if (!organization) return c.json({ message: "User organization not found" }, 404);

    const accessPayload: TokenPayload = {
        userId: parsed.userId,
        firstname: parsed.firstname,
        email: parsed.email,
        currentOrgId: parsed.currentOrgId,
        organizationName: organization.name,
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
