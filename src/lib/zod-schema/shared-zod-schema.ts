import { z } from "zod";
import { MAX_IMAGE_SIZE, ACCEPTED_IMAGE_TYPES } from "../constants";

export const UserSchema = z.object({
    firstname: z.string(),
    avatar: z
        .instanceof(Blob)
        .optional()
        .refine((blob) => !blob || blob?.size <= MAX_IMAGE_SIZE, `Max image size is 5mb.`)
        .refine(
            (blob) => !blob || ACCEPTED_IMAGE_TYPES.includes(blob?.type),
            "Only .jpg, .jpeg, .png and .webp formats are supported.",
        ),
});

export const UserSettingsSchema = z.object({
    firstname: z.string(),
    avatarURL: z.string().nullable(),
});

export const BusinessSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    // phone: z.string(),
    website: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    logo: z
        .instanceof(Blob)
        .optional()
        .refine((blob) => !blob || blob?.size <= MAX_IMAGE_SIZE, `Max image size is 5MB.`)
        .refine(
            (blob) => !blob || ACCEPTED_IMAGE_TYPES.includes(blob?.type),
            "Only .jpg, .jpeg, .png and .webp formats are supported.",
        ),
});

export const BusinessSettingsSchema = z.object({
    logoURL: z.string().nullable(),
    name: z.string(),
    email: z.string(),
    // phone: z.string(),
    website: z.string().optional(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
});

export const TopStatsSchema = z.object({
    totalRevenue: z.number(),
    paidInvoices: z.number(),
    pendingInvoices: z.number(),
    totalClients: z.number(),
});

export const FeedbackSchema = z.object({
    subject: z.string().optional(),
    description: z.string(),
});

export const DashboardRevenueQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    currency: z.string().min(1).optional(),
});

/* Subscription Plan Zod Schemas */
export const SubscriptionPlanSchema = z.object({
    id: z.union([z.number(), z.string()]),
    planCode: z.string(),
    name: z.string(),
    description: z.string(),
    amount: z.number(),
    currency: z.string(),
    interval: z.string(),
    features: z.array(z.string()),
    disabled: z.boolean(),
    featured: z.boolean(),
    cta: z.string(),
});
