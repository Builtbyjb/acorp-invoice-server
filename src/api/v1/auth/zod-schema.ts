import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().email(),
});

export const otpSchema = z.object({
    otp: z.string().length(8),
    otpToken: z.string().optional(),
});

export const signupSchema = z.object({
    firstname: z.string().min(2),
    lastname: z.string().min(2),
    email: z.string().min(2),
    businessName: z.string().min(2),
    country: z.string().min(2),
    referral: z.string().optional(),
});
