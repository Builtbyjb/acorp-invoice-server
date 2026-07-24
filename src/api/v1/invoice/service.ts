import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, desc, sql } from "drizzle-orm";
import { clients, invoices } from "@/db/schema";
import { members, organizations } from "@/db/schema";
import { getNewInvoiceNumber } from "@/lib/utils";
import { TokenPayload } from "@/lib/types";

export async function getOrganizationMember(db: NodePgDatabase, userId: number) {
    return db.select().from(members).where(eq(members.userId, userId));
}

export async function getOrganizationById(db: NodePgDatabase, orgId: number) {
    return db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .then((result) => result[0]);
}

export async function countOrgInvoices(db: NodePgDatabase, orgId: number) {
    const baseWhere = and(eq(clients.organizationId, orgId), eq(clients.deleted, false), eq(invoices.deleted, false));

    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(baseWhere)
        .then((result) => result[0]);

    return countResult?.count ?? 0;
}

export async function fetchOrgInvoicesPage(db: NodePgDatabase, orgId: number, page: number, size: number) {
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

export async function getClientInvoices(db: NodePgDatabase, clientId: string) {
    return db
        .select()
        .from(invoices)
        .where(and(eq(invoices.clientId, clientId), eq(invoices.deleted, false)))
        .orderBy(desc(invoices.createdAt));
}

export async function getSingleInvoice(db: NodePgDatabase, clientId: string, invoiceId: string) {
    return db
        .select()
        .from(invoices)
        .where(and(eq(invoices.clientId, clientId), eq(invoices.id, invoiceId), eq(invoices.deleted, false)))
        .then();
}

export async function getClientRecord(db: NodePgDatabase, clientId: string) {
    return db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .then((result) => result[0]);
}

export async function createInvoiceRecord(db: NodePgDatabase, data: any, jwtPayload: TokenPayload) {
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
            clientName: data.clientName,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            status: data.status,
            signature: data.signature,
            discount: data.discount,
            taxRate: data.taxRate,
            items: data.items,
            notes: data.notes,
            currency: data.currency,
            paymentDate: data.status === "paid" && !data.paymentDate ? new Date() : (data.paymentDate ?? null),
        })
        .returning({ id: invoices.id });

    await db
        .update(organizations)
        .set({ invoiceNumber: newInvoiceNumber })
        .where(eq(organizations.id, jwtPayload.currentOrgId));

    return { invoiceId, invoiceNumber };
}

export async function updateInvoiceRecord(db: NodePgDatabase, invoiceId: string, data: any) {
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
            paymentDate: data.status === "paid" && !data.paymentDate ? new Date() : (data.paymentDate ?? null),
        })
        .where(eq(invoices.id, invoiceId));
}

export async function softDeleteInvoice(db: NodePgDatabase, invoiceId: string) {
    await db.update(invoices).set({ deleted: true }).where(eq(invoices.id, invoiceId));
}
