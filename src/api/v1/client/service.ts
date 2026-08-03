import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, and, like, desc } from "drizzle-orm";
import { clients, invoices } from "@/db/schema";
// import { members } from "@/db/schema";
import { ClientListSchema, ClientSchema } from "@/lib/zod-schema/client-zod-schema";
import type { ClientDTO, FetchedClients } from "@/lib/types/client-types";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import type { FetchedInvoices } from "@/lib/types/invoice-types";
import { InvoiceListSchema } from "@/lib/zod-schema/invoice-zod-schema";

export async function fetchClientsPage(
    db: NodePgDatabase,
    orgId: number,
    page: number,
    size: number,
): Promise<FetchedClients> {
    const baseWhere = and(eq(clients.organizationId, orgId), eq(clients.deleted, false));
    const limit = Math.min(size, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const [totalCount, result] = await Promise.all([
        // Total count
        db.$count(clients, baseWhere),

        // Clients result
        db
            .select()
            .from(clients)
            .where(baseWhere)
            .orderBy(desc(clients.createdAt))
            .limit(limit)
            .offset(offset),
    ]);

    return {
        data: ClientListSchema.parse(result),
        meta: {
            totalCount: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            perPage: limit,
        },
    };
}

export async function getClientById(db: NodePgDatabase, id: string): Promise<ClientDTO | null> {
    const result = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, id), eq(clients.deleted, false)));

    if (result.length === 0) return null;

    return ClientSchema.parse(result[0]);
}

export async function fetchClientInvoicesPage(
    db: NodePgDatabase,
    clientId: string,
    page: number,
    size: number,
): Promise<FetchedInvoices> {
    const baseWhere = and(eq(invoices.clientId, clientId), eq(invoices.deleted, false));
    const limit = Math.min(size, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const [totalCount, result] = await Promise.all([
        // Total client invoices count
        db.$count(invoices, baseWhere),

        // Total client invoices
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

export async function createClientRecord(
    db: NodePgDatabase,
    data: {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        country?: string;
    },
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
        .then((result) => result[0]);

    return ClientSchema.parse(client);
}

export async function softDeleteClient(db: NodePgDatabase, id: string) {
    await db.update(clients).set({ deleted: true }).where(eq(clients.id, id));
}

export async function updateClientRecord(
    db: NodePgDatabase,
    id: string,
    data: {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        country?: string;
    },
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

export async function searchClientsByName(db: NodePgDatabase, orgId: number, query: string) {
    return db
        .select()
        .from(clients)
        .where(
            and(
                eq(clients.organizationId, orgId),
                like(clients.name, `%${query}%`),
                eq(clients.deleted, false),
            ),
        );
}
