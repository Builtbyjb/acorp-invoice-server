import { boolean, integer, jsonb, numeric, PgInteger, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { InvoiceNumber, InvoiceItem } from "@/lib/types";

export const users = pgTable("users", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: varchar("email").notNull().unique(),
    currentOrgId: integer("currency_organization_id")
        .references(() => organizations.id)
        .notNull(),
    firstname: varchar("firstname").notNull(),
    lastname: varchar("lastname").notNull(),
    avatarURL: varchar("avatar_url"),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name").notNull().unique(),
    type: varchar("type"),
    address: varchar("address"),
    city: varchar("city"),
    country: varchar("country"),
    website: varchar("website"),
    logoURL: varchar("logo_url"),
    invoiceNumber: jsonb("invoice_number").$type<InvoiceNumber>().notNull().default({ currentNumber: 0, year: 2000 }),
    referralCode: varchar("referral_code").unique(),
    referredBy: integer("referred_by")
        .references((): PgInteger => organizations.id)
        .unique(),
    referralEnabled: boolean("referral_enabled").notNull().default(false),
    totalEarnings: numeric("total_earnings").$type<number>().notNull().default(0),
    currency: varchar("currency").notNull().default("NGN"),
    referralPayoutMethod: varchar("referral_payout_method"),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable("members", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer("organization_id")
        .references(() => organizations.id)
        .notNull(),
    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),
    roleId: integer("role_id")
        .references(() => roles.id)
        .notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).defaultNow(),
    endDate: timestamp("end_date", { withTimezone: true }),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable("roles", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name").notNull().unique(),
    permissions: varchar("permissions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable("clients", {
    id: varchar("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    name: varchar("name").notNull(),
    email: varchar("email"),
    phone: varchar("phone"),
    address: varchar("address"),
    city: varchar("city"),
    country: varchar("country"),
    note: varchar("note"),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
    id: varchar("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    invoiceNumber: varchar("invoice_number").notNull(),
    clientId: varchar("client_id")
        .references(() => clients.id)
        .notNull(),
    clientName: varchar("client_name").notNull(),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: varchar("status").notNull(),
    signature: varchar("signature"),
    taxRate: numeric("tax_rate").$type<number>().notNull().default(0),
    discount: numeric("discount").$type<number>().notNull().default(0),
    items: jsonb("items").$type<InvoiceItem[]>().notNull().default([]),
    notes: varchar("notes"),
    currency: varchar("currency").notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }),
    notified: boolean("notified").notNull().default(false),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payouts = pgTable("payouts", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    organizationId: integer("organization_id")
        .references(() => organizations.id)
        .notNull(),
    amount: numeric("amount").$type<number>().notNull(),
    currency: varchar("currency").notNull(),
    status: varchar("status", { enum: ["pending", "processing", "completed", "failed"] })
        .notNull()
        .default("pending"),
    provider: varchar("provider").notNull(),
    reference: varchar("reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
