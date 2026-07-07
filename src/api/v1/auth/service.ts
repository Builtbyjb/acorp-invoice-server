import { DrizzleD1Database } from "drizzle-orm/d1";
import { organizations } from "../../../db/schemas";
import { eq } from "drizzle-orm";

export async function validateReferral(db: DrizzleD1Database, referral: string): Promise<number | null> {
    const org = await db.select().from(organizations).where(eq(organizations.referralCode, referral)).get();
    return org ? org.id : null;
}
