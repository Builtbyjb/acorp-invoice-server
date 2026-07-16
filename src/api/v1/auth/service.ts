import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { REFRESH_TOKEN_MAX_AGE } from "@/lib/constants";

export async function validateReferral(db: NodePgDatabase, referral: string): Promise<number | null> {
    const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.referralCode, referral))
        .then((result) => result[0]);

    return org ? org.id : null;
}

const REFRESH_TOKEN_PREFIX = "refresh:";

function getKVKey(tokenId: string): string {
    return `${REFRESH_TOKEN_PREFIX}${tokenId}`;
}

export async function storeRefreshToken(c: Context, tokenId: string, token: string): Promise<void> {
    await c.env.KV_STORE.put(getKVKey(tokenId), token, {
        expirationTtl: REFRESH_TOKEN_MAX_AGE,
    });
}

export async function getRefreshToken(c: Context, tokenId: string): Promise<string | null> {
    return await c.env.KV_STORE.get(getKVKey(tokenId));
}

export async function deleteRefreshToken(c: Context, tokenId: string): Promise<void> {
    await c.env.KV_STORE.delete(getKVKey(tokenId));
}

export async function generateTokens() {}
