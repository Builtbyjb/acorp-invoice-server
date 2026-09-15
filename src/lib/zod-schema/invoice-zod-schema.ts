import { z } from "zod";

export const InvoiceQuerySchema = z.object({
    clientID: z.string().optional(),
    invoiceID: z.string().optional(),
    page: z.number().optional().default(1),
    size: z.number().optional().default(10),
});

export const ClientInfoSchema = z.object({
    email: z.string().email(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
});

export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue"]);

export const InvoiceItemSchema = z.object({
    id: z.string(),
    description: z.string(),
    quantity: z.number(),
    unit: z.string(),
    price: z.number(),
});

export const InvoiceFormSchema = z.object({
    clientID: z.string().optional(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    discount: z.number().min(0).max(100),
    taxRate: z.number().min(0).max(100),
    status: InvoiceStatusSchema,
    items: z.array(InvoiceItemSchema),
    currency: z.string(),
    notes: z.string(),
    signature: z.string().optional(),
});

export const InvoiceSchema = z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    clientID: z.string(),
    clientName: z.string(),
    clientInfo: ClientInfoSchema,
    items: z.array(InvoiceItemSchema),
    taxRate: z.coerce.number(),
    discount: z.coerce.number(),
    status: InvoiceStatusSchema,
    signature: z.string().nullable(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    currency: z.string(),
    notes: z.string(),
    createdAt: z.coerce.date(),
});

export const InvoiceListSchema = z.array(InvoiceSchema);
