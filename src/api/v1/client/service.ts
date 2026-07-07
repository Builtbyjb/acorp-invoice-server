import { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, like, desc } from "drizzle-orm";
import { clients, invoices } from "../../../../db/invoice-schema";
import { members } from "../../../../db/schemas";
import { ClientListSchema, ClientSchema } from "../../../../lib/zod-schema";

export async function getOrganizationMember(db: DrizzleD1Database, userId: number) {
    return db.select().from(members).where(eq(members.userId, userId));
}

export async function countClients(db: DrizzleD1Database, orgId: number) {
    const baseWhere = and(eq(clients.organizationId, orgId), eq(clients.deleted, false));
    return db.$count(clients, baseWhere);
}

export async function fetchClientsPage(db: DrizzleD1Database, orgId: number, page: number, size: number) {
    const baseWhere = and(eq(clients.organizationId, orgId), eq(clients.deleted, false));
    const offset = (page - 1) * size;

    const result = await db
        .select()
        .from(clients)
        .where(baseWhere)
        .orderBy(desc(clients.createdAt))
        .limit(size)
        .offset(offset);

    return ClientListSchema.parse(result);
}

export async function getClientById(db: DrizzleD1Database, id: string) {
    return db
        .select()
        .from(clients)
        .where(and(eq(clients.id, id), eq(clients.deleted, false)))
        .get();
}

export async function countClientInvoices(db: DrizzleD1Database, clientId: string) {
    const baseWhere = and(eq(invoices.clientId, clientId), eq(invoices.deleted, false));
    return db.$count(invoices, baseWhere);
}

export async function fetchClientInvoicesPage(db: DrizzleD1Database, clientId: string, page: number, size: number) {
    const baseWhere = and(eq(invoices.clientId, clientId), eq(invoices.deleted, false));
    const offset = (page - 1) * size;

    return db.select().from(invoices).where(baseWhere).orderBy(desc(invoices.createdAt)).limit(size).offset(offset);
}

export async function createClientRecord(
    db: DrizzleD1Database,
    data: { name: string; email?: string; phone?: string; address?: string; city?: string; country?: string },
    orgId: number,
) {
    const client = await db
        .insert(clients)
        .values({
            id: crypto.randomUUID(),
            organizationId: orgId,
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            country: data.country,
        })
        .returning()
        .get();

    return ClientSchema.parse(client);
}

export async function softDeleteClient(db: DrizzleD1Database, id: string) {
    await db.update(clients).set({ deleted: true }).where(eq(clients.id, id));
}

export async function updateClientRecord(
    db: DrizzleD1Database,
    id: string,
    data: { name: string; email?: string; phone?: string; address?: string; city?: string; country?: string },
) {
    await db
        .update(clients)
        .set({
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            country: data.country,
        })
        .where(eq(clients.id, id));
}

export async function searchClientsByName(db: DrizzleD1Database, orgId: number, query: string) {
    return db
        .select()
        .from(clients)
        .where(and(eq(clients.organizationId, orgId), like(clients.name, `%${query}%`), eq(clients.deleted, false)));
}
