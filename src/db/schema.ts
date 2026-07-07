import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { InvoiceNumber } from "@shared/lib/types";

export const users = sqliteTable("users", {
    id: int("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    currentOrgId: int("currency_organization_id")
        .references(() => organizations.id)
        .notNull(),
    firstname: text("firstname"),
    lastname: text("lastname"),
    username: text("username").notNull(),
    avatarURL: text("avatar_url"),
    deleted: int("deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});

export const organizations = sqliteTable("organizations", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    type: text("type").notNull(),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    website: text("website"),
    logoURL: text("logo_url"),
    invoiceNumber: text("invoice_number", { mode: "json" })
        .$type<InvoiceNumber>()
        .notNull()
        .default({ currentNumber: 0, year: 2000 }),
    referralCode: text("referral_code").unique(),
    referredBy: int("referred_by").unique(),
    referralEnabled: int("referral_enabled", { mode: "boolean" }).notNull().default(false),
    totalEarnings: int("total_earnings").notNull().default(0),
    paystackCustomerCode: text("paystack_customer_code").unique(),
    paystackCustomerId: int("paystack_customer_id").unique(),
    paystackPlanCode: text("paystack_plan_code"),
    paystackPlanId: int("paystack_plan_id"),
    paystackSubscriptionStatus: text("paystack_subscription_status", {
        enum: ["active", "non-renewing", "cancelled", "none"],
    })
        .notNull()
        .default("none"),
    paymentProvider: text("payment_provider", { enum: ["paystack", "stripe"] })
        .notNull()
        .default("paystack"),
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePlanCode: text("stripe_plan_code"),
    stripePlanId: text("stripe_plan_id"),
    stripeSubscriptionStatus: text("stripe_subscription_status", {
        enum: ["active", "non-renewing", "cancelled", "none"],
    })
        .notNull()
        .default("none"),
    currency: text("currency").notNull().default("NGN"),
    referralPayoutMethod: text("referral_payout_method"),
    deleted: int("deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});

export const members = sqliteTable("members", {
    id: int("id").primaryKey({ autoIncrement: true }),
    organizationId: int("organization_id")
        .references(() => organizations.id)
        .notNull(),
    userId: int("user_id")
        .references(() => users.id)
        .notNull(),
    roleId: int("role_id")
        .references(() => roles.id)
        .notNull(),
    startDate: int("start_date", { mode: "timestamp" }).default(sql`(unixepoch())`),
    endDate: int("end_date", { mode: "timestamp" }),
    deleted: int("deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});

export const roles = sqliteTable("roles", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    permissions: text("permissions").notNull(),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});
export const clients = sqliteTable("clients", {
    id: text("id").primaryKey(),
    organizationId: int("organization_id").references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    deleted: int("deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});

export const invoices = sqliteTable("invoices", {
    id: text("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull(),
    clientId: text("client_id")
        .references(() => clients.id)
        .notNull(),
    issueDate: int("issue_date", { mode: "timestamp" }).notNull(),
    dueDate: int("due_date", { mode: "timestamp" }).notNull(),
    status: text("status").notNull(),
    signature: text("signature"),
    taxRate: int("tax_rate", { mode: "number" }).notNull().default(0),
    discount: int("discount", { mode: "number" }).notNull().default(0),
    items: text("items", { mode: "json" })
        .$type<InvoiceItem[]>()
        .notNull()
        .default(sql`'[]'`),
    notes: text("notes"),
    currency: text("currency").notNull(),
    notified: int("notified", { mode: "boolean" }).notNull().default(false),
    deleted: int("deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});

export const payouts = sqliteTable("payouts", {
    id: int("id").primaryKey({ autoIncrement: true }),
    organizationId: int("organization_id")
        .references(() => organizations.id)
        .notNull(),
    amount: int("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["pending", "processing", "completed", "failed"] })
        .notNull()
        .default("pending"),
    provider: text("provider").notNull(),
    reference: text("reference"),
    createdAt: int("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    updatedAt: int("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => sql`(unixepoch())`),
});
