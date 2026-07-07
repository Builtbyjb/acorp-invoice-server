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
    username: z.string().min(2),
    businessName: z.string().min(2),
    businessType: z.string().min(2),
    businessAddress: z.string().min(2),
    city: z.string().min(2),
    country: z.enum(["USA", "Canada", "Nigeria"]),
    website: z.string(),
    referral: z.string().optional(),
    paymentProvider: z.enum(["paystack", "stripe"]).optional(),
    currency: z.string().optional(),
});
