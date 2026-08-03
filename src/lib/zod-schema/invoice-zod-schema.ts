import { z } from "zod";

export const InvoiceQuerySchema = z.object({
    clientId: z.string().optional(),
    invoiceId: z.string().optional(),
    page: z.string().optional(),
    size: z.string().optional(),
});

export const ClientInfoSchema = z.object({
    email: z.string().email(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
});

export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue"]);

const InvoiceItemSchema = z.object({
    id: z.string(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
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
    signature: z.string().nullable(),
});

export const InvoiceSchema = z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    clientID: z.string(),
    clientName: z.string(),
    ClientInfo: ClientInfoSchema,
    items: z.array(InvoiceItemSchema),
    taxRate: z.number(),
    discount: z.number(),
    status: InvoiceStatusSchema,
    signature: z.string().nullable(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    currency: z.string(),
    notes: z.string(),
    createdAt: z.coerce.date(),
});

export const InvoiceListSchema = z.array(InvoiceSchema);
