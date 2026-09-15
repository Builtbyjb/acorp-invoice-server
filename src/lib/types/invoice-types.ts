import { z } from "zod";
import {
    InvoiceStatusSchema,
    ClientInfoSchema,
    InvoiceSchema,
    InvoiceItemSchema,
    InvoiceFormSchema,
} from "../zod-schema/invoice-zod-schema";
import { invoices } from "@/db/schema";
import type { PaginationMetadata } from "./shared-types";

export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
export type InvoiceClientInfo = z.infer<typeof ClientInfoSchema>;
export type InvoiceDTO = z.infer<typeof InvoiceSchema>;
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type InvoiceForm = z.infer<typeof InvoiceFormSchema>;

export type InvoiceStatusData = {
    status: InvoiceStatus;
    count: number;
};

export type InvoiceNumber = {
    year: number;
    currentNumber: number;
};

export type Invoice = typeof invoices.$inferSelect;

export type FetchedInvoices = {
    data: InvoiceDTO[];
    meta: PaginationMetadata;
};
