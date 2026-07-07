import { z } from "zod";
import { MAX_IMAGE_SIZE, ACCEPTED_IMAGE_TYPES } from "./constants";

export const UserSchema = z.object({
    username: z.string(),
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
    username: z.string(),
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

/* Invoice Zod Schemas */
export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue"]);

export const InvoiceFormSchema = z.object({
    clientId: z.string().optional(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    discount: z.number().min(0).max(100),
    taxRate: z.number().min(0).max(100),
    status: InvoiceStatusSchema,
    signature: z.string().optional(),
    items: z.array(
        z.object({
            description: z.string(),
            quantity: z.number().positive(),
            unitPrice: z.number().positive(),
        }),
    ),
    currency: z.string(),
    notes: z.string(),
});

export const InvoiceItemSchema = z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
});

export const InvoiceSchema = z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    clientId: z.string(),
    items: z.array(InvoiceItemSchema),
    taxRate: z.number(),
    discount: z.number(),
    status: InvoiceStatusSchema,
    signature: z.string().nullable(),
    issueDate: z.string(),
    dueDate: z.string(),
    currency: z.string(),
    notes: z.string(),
    createdAt: z.string(),
});

/* Client Zod Schemas */
export const ClientSchema = z.object({
    id: z.string(),
    organizationId: z.number(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    createdAt: z.coerce.date(),
});

export const ClientListSchema = z.array(ClientSchema);

export const ClientFormSchema = z.object({
    name: z.string().nonempty(),
    email: z.string().email(),
    phone: z.string(),
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
