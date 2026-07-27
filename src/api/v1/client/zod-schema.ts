import { z } from "zod";

export const ClientFormSchema = z.object({
    name: z.string().nonempty(),
    email: z.string().email(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    note: z.string(),
});

export const ClientSchema = z.object({
    id: z.string(),
    organizationId: z.number(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    note: z.string().nullable(),
    createdAt: z.coerce.date(),
});

export const ClientListSchema = z.array(ClientSchema);
