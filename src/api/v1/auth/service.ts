import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function validateReferral(db: NodePgDatabase, referral: string): Promise<number | null> {
    const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.referralCode, referral))
        .then((result) => result[0]);

    return org ? org.id : null;
}
