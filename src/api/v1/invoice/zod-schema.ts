import { z } from "zod";

export const InvoiceQuerySchema = z.object({
    clientId: z.string().optional(),
    invoiceId: z.string().optional(),
    page: z.string().optional(),
    size: z.string().optional(),
});
