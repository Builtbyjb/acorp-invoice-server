import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { clients, invoices } from "../db/schema";
import { users, organizations, payouts } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSubscriptionAmount } from "../api/v1/referral/service";
import { type ENV } from "./types";

const REWARD = 0.05;

async function getDb(env: ENV): Promise<{ db: NodePgDatabase; client: Client }> {
    const connectionString = env.DB.connectionString;
    const client = new Client({ connectionString });
    await client.connect();
    const db = drizzle({ client });
    return { db, client };
}

/* Handles overdue invoice notifications */
export async function invoiceNotify(env: ENV): Promise<any> {
    const { db, client } = await getDb(env);

    try {
        const allUsers = await db.select().from(users).where(eq(users.deleted, false));

        for (const user of allUsers) {
            const organization = await db.select().from(organizations).where(eq(organizations.id, user.currentOrgId)).get();
            if (!organization) continue;

            const provider = (organization.paymentProvider || "paystack") as "paystack" | "stripe";
            const customerId = provider === "paystack" ? organization.paystackCustomerId : organization.stripeCustomerId;

            if (!customerId) continue;

            const allClients = await db
                .select()
                .from(clients)
                .where(and(eq(clients.deleted, false), eq(clients.organizationId, user.currentOrgId)));

            for (const client of allClients) {
                const allInvoices = await db.select().from(invoices).where(eq(invoices.clientId, client.id));

                for (const invoice of allInvoices) {
                    if (invoice.notified) continue;

                    if (invoice.status === "sent" || invoice.status === "overdue") {
                        if (new Date(invoice.dueDate) < new Date()) {
                            await env.SEND_EMAIL.send({
                                from: "notify-noreply@acorp.app",
                                to: user.email,
                                subject: `Invoice Overdue: ${invoice.invoiceNumber}`,
                                text: `Invoice ${invoice.invoiceNumber} for ${client.name} is overdue. Consider sending a payment reminder.`,
                            });

                            await db.update(invoices).set({ notified: true }).where(eq(invoices.id, invoice.id));
                        }
                    }
                }
            }
        }
    } finally {
        await client.end();
    }
}

/* Creates a Paystack transfer recipient */
async function createPaystackRecipient(bankDetails: any, env: ENV): Promise<string | null> {
    try {
        const response = await fetch("https://api.paystack.co/transferrecipient", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.PAYSTACK_SECRET}`,
            },
            body: JSON.stringify({
                type: "nuban",
                name: bankDetails.accountHolderName,
                account_number: bankDetails.accountNumber,
                bank_code: bankDetails.bankCode,
                currency: "NGN",
            }),
        });

        const result: any = await response.json();
        if (result.status && result.data?.recipient_code) {
            return result.data.recipient_code;
        }
        return null;
    } catch (error) {
        console.error("Failed to create Paystack recipient:", error);
        return null;
    }
}

/* Handles referral rewards payout processing */
export async function payout(env: ENV): Promise<any> {
    const { db, client } = await getDb(env);

    try {
        const referrers = await db
            .select()
            .from(organizations)
            .where(and(eq(organizations.referralEnabled, true), eq(organizations.deleted, false)));

        for (const referrer of referrers) {
            if (!referrer.referralPayoutMethod) continue;

            const currency = referrer.currency || "NGN";
            const subAmount = getSubscriptionAmount(currency);
            const provider = (referrer.paymentProvider || "paystack") as "paystack" | "stripe";

            const activeReferrals = await db.$count(
                organizations,
                and(
                    eq(organizations.referredBy, referrer.id),
                    sql`(
                        ${organizations.paystackSubscriptionStatus} = 'active'
                        OR ${organizations.stripeSubscriptionStatus} = 'active'
                    )`,
                    eq(organizations.deleted, false),
                ),
            );

            if (activeReferrals === 0) continue;

            const payoutAmount = Math.round(activeReferrals * subAmount * REWARD);
            if (payoutAmount <= 0) continue;

            const payoutRecord = await db
                .insert(payouts)
                .values({
                    organizationId: referrer.id,
                    amount: payoutAmount,
                    currency,
                    status: "pending",
                    provider,
                })
                .returning()
                .get();

            try {
                const bankDetails = JSON.parse(referrer.referralPayoutMethod);
                let reference: string | null = null;

                if (provider === "paystack") {
                    const recipientCode = await createPaystackRecipient(bankDetails, env);
                    if (recipientCode) {
                        // Transfer logic placeholder
                    }
                } else {
                    if (bankDetails.connectedAccountId) {
                        // Stripe Connect payout placeholder
                    }
                }

                await db
                    .update(payouts)
                    .set({
                        status: reference ? "processing" : "pending",
                        reference: reference || null,
                    })
                    .where(eq(payouts.id, payoutRecord.id));

                await db
                    .update(organizations)
                    .set({
                        totalEarnings: sql`${organizations.totalEarnings} + ${payoutAmount}`,
                    })
                    .where(eq(organizations.id, referrer.id));
            } catch (error) {
                console.error(`Payout failed for organization ${referrer.id}:`, error);
                await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, payoutRecord.id));
            }
        }
    } finally {
        await client.end();
    }
}
