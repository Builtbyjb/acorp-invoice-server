import { ContentfulStatusCode } from "hono/utils/http-status";
import type { JWTPayload } from "hono/utils/jwt/types";
import { clients, invoices } from "@/db/schema";

export type ENV = {
    DB: Hyperdrive;
    OTP_EMAIL: string;
    JWT_SECRET: string;
    SEND_EMAIL: {
        send: (email: { to: string; from: string; subject: string; text: string; html?: string }) => Promise<any>;
    };
    ENV: string;
    INVOICE_URL: string;
    SERVER_URL: string;
    R2: R2Bucket;
    RATE_LIMITER: RateLimit;
};

export type TokenPayload = JWTPayload & {
    userId: number;
    email: string;
    username: string;
    currentOrgId: number;
    organizationName?: string;
    otp?: string;
};

export type ReturnId = {
    id: number | undefined;
};

export class ErrorResult extends Error {
    public code: ContentfulStatusCode;

    constructor(message: string, code: ContentfulStatusCode, options?: ErrorOptions) {
        super(message, options);

        this.code = code;
        this.name = "ErrorResult";

        Object.setPrototypeOf(this, ErrorResult.prototype);
    }
}

export type Client = typeof clients.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;

export type InvoiceNumber = {
    year: number;
    currentNumber: number;
};

export type InvoiceItem = {
    description: string;
    quantity: number;
    unitPrice: number;
};

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type InvoiceStatusData = {
    status: InvoiceStatus;
    count: number;
};

export type MonthRevenue = {
    month: string;
    revenue: number;
};

export type TopStats = {
    totalRevenue: number;
    paidInvoices: number;
    pendingInvoices: number;
    totalClients: number;
};

// export type Invoice = {
//     id: string;
//     invoiceNumber: string;
//     clientId: string;
//     items: InvoiceItem[];
//     taxRate: number;
//     discount: number;
//     status: InvoiceStatus;
//     signature: string | null;
//     issueDate: string;
//     dueDate: string;
//     currency: string;
//     notes: string;
//     createdAt: string;
// };

export type DashboardStats = {
    topStats: TopStats;
    invoiceData: InvoiceStatusData[];
    monthlyRevenues: MonthRevenue[];
};
