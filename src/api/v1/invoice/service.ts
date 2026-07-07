import { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import { clients, invoices } from "../../../../db/invoice-schema";
import { members, organizations } from "../../../../db/schemas";
import { getNewInvoiceNumber } from "../../../../lib/utils";
import { TokenPayload } from "../../../../lib/types";

export async function getOrganizationMember(db: DrizzleD1Database, userId: number) {
    return db.select().from(members).where(eq(members.userId, userId));
}

export async function getOrganizationById(db: DrizzleD1Database, orgId: number) {
    return db.select().from(organizations).where(eq(organizations.id, orgId)).get();
}

export async function countOrgInvoices(db: DrizzleD1Database, orgId: number) {
    const baseWhere = and(eq(clients.organizationId, orgId), eq(clients.deleted, false), eq(invoices.deleted, false));

    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(baseWhere)
        .get();

    return countResult?.count ?? 0;
}

export async function fetchOrgInvoicesPage(db: DrizzleD1Database, orgId: number, page: number, size: number) {
    const baseWhere = and(eq(clients.organizationId, orgId), eq(clients.deleted, false), eq(invoices.deleted, false));

    const offset = (page - 1) * size;

    const result = await db
        .select()
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(baseWhere)
        .orderBy(desc(invoices.createdAt))
        .limit(size)
        .offset(offset);

    return result.map((r) => r.invoices);
}

export async function getClientInvoices(db: DrizzleD1Database, clientId: string) {
    return db
        .select()
        .from(invoices)
        .where(and(eq(invoices.clientId, clientId), eq(invoices.deleted, false)))
        .orderBy(desc(invoices.createdAt));
}

export async function getSingleInvoice(db: DrizzleD1Database, clientId: string, invoiceId: string) {
    return db
        .select()
        .from(invoices)
        .where(and(eq(invoices.clientId, clientId), eq(invoices.id, invoiceId), eq(invoices.deleted, false)))
        .get();
}

export async function getClientRecord(db: DrizzleD1Database, clientId: string) {
    return db.select().from(clients).where(eq(clients.id, clientId)).get();
}

export async function createInvoiceRecord(db: DrizzleD1Database, data: any, jwtPayload: TokenPayload) {
    const organization = await getOrganizationById(db, jwtPayload.currentOrgId);
    if (!organization) return null;

    const newInvoiceNumber = getNewInvoiceNumber(organization.invoiceNumber);
    const invoiceNumber = "INV-" + newInvoiceNumber.year + "-" + newInvoiceNumber.currentNumber;

    const invoiceId = await db
        .insert(invoices)
        .values({
            id: crypto.randomUUID(),
            invoiceNumber: invoiceNumber,
            clientId: data.clientId,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            status: data.status,
            signature: data.signature,
            discount: data.discount,
            taxRate: data.taxRate,
            items: data.items,
            notes: data.notes,
            currency: data.currency,
        })
        .returning({ id: invoices.id })
        .get();

    await db
        .update(organizations)
        .set({ invoiceNumber: newInvoiceNumber })
        .where(eq(organizations.id, jwtPayload.currentOrgId));

    return { invoiceId, invoiceNumber };
}

export async function updateInvoiceRecord(db: DrizzleD1Database, invoiceId: string, data: any) {
    await db
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
        .where(eq(invoices.id, invoiceId));
}

export async function softDeleteInvoice(db: DrizzleD1Database, invoiceId: string) {
    await db.update(invoices).set({ deleted: true }).where(eq(invoices.id, invoiceId));
}
