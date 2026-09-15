import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, desc, sql } from "drizzle-orm";
import { clients, invoices } from "@/db/schema";
import { members, organizations } from "@/db/schema";
import { getNewInvoiceNumber } from "@/lib/utils";
// import type { TokenPayload } from "@/lib/types/shared-types";
import type { FetchedInvoices, InvoiceDTO, InvoiceForm } from "@/lib/types/invoice-types";
import { InvoiceListSchema, InvoiceSchema } from "@/lib/zod-schema/invoice-zod-schema";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { getClientById } from "../client/service";

export async function getOrganizationMember(db: NodePgDatabase, userID: number) {
    return db.select().from(members).where(eq(members.userID, userID));
}

export async function getOrganizationById(db: NodePgDatabase, orgId: number) {
    return db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .then((result) => result[0]);
}

export async function fetchOrgInvoicesPage(
    db: NodePgDatabase,
    orgId: number,
    page: number,
    size: number,
): Promise<FetchedInvoices> {
    const baseWhere = and(eq(invoices.organizationID, orgId), eq(invoices.deleted, false));
    const limit = Math.min(size, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const [totalCount, result] = await Promise.all([
        db.$count(invoices, baseWhere),
        db
            .select()
            .from(invoices)
            .where(baseWhere)
            .orderBy(desc(invoices.createdAt))
            .limit(size)
            .offset(offset),
    ]);

    return {
        data: InvoiceListSchema.parse(result),
        meta: {
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            perPage: limit,
        },
    };
}

export async function getInvoiceById(db: NodePgDatabase, id: string): Promise<InvoiceDTO | null> {
    const result = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.deleted, false)));

    if (result.length === 0) return null;

    return InvoiceSchema.parse(result[0]);
}

export async function createInvoiceRecord(
    db: NodePgDatabase,
    data: InvoiceForm,
    orgID: number,
): Promise<InvoiceDTO | null> {
    if (!data.clientID) return null;

    const [organization, client] = await Promise.all([
        getOrganizationById(db, orgID),
        getClientById(db, data.clientID),
    ]);

    if (!organization) return null;
    if (!client) return null;

    const newInvoiceNumber = getNewInvoiceNumber(organization.invoiceNumber);
    const invoiceNumber = "INV-" + newInvoiceNumber.year + "-" + newInvoiceNumber.currentNumber;

    const invoice = await db
        .insert(invoices)
        .values({
            id: crypto.randomUUID(),
            organizationID: organization.id,
            invoiceNumber: invoiceNumber,
            clientID: data.clientID,
            clientName: client.name,
            clientInfo: {
                email: client.email,
                phone: client.phone,
                address: client.address,
                city: client.city,
                country: client.country,
            },
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            status: data.status,
            signature: data.signature,
            discount: data.discount,
            taxRate: data.taxRate,
            items: data.items,
            notes: data.notes,
            currency: data.currency,
            paymentDate: null,
        })
        .returning();

    await db
        .update(organizations)
        .set({ invoiceNumber: newInvoiceNumber })
        .where(eq(organizations.id, orgID));

    return InvoiceSchema.parse(invoice[0]);
}

export async function updateInvoiceRecord(
    db: NodePgDatabase,
    invoiceID: string,
    data: InvoiceForm,
) {
    const result = await db
        .update(invoices)
        .set({
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            status: data.status,
            discount: data.discount,
            taxRate: data.taxRate,
            items: data.items,
            signature: data.signature,
            notes: data.notes,
            currency: data.currency,
        })
        .where(and(eq(invoices.id, invoiceID), eq(invoices.deleted, false)))
        .returning();

    if (result.length === 0) return null;

    return InvoiceSchema.parse(result[0]);
}

export async function softDeleteInvoice(db: NodePgDatabase, invoiceId: string) {
    await db.update(invoices).set({ deleted: true }).where(eq(invoices.id, invoiceId));
}
