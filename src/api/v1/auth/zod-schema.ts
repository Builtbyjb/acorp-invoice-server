import { z } from "zod";

export const signinSchema = z.object({
    email: z.string().email(),
});

export const otpSchema = z.object({
    code: z.string().length(8),
});

export const signupSchema = z.object({
    firstname: z.string().min(2),
    lastname: z.string().min(2),
    email: z.string().min(2),
    businessName: z.string().min(2),
    country: z.string().min(2),
    referral: z.string().optional(),
});
