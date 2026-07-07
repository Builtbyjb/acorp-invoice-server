export function generateReferralCode(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function generateReferralLink(env: string | null = null, code: string | null): string {
    if (!code) return "No referral code";

    if (env && env === "dev") return `http://localhost:5173/signup?referral=${code}`;
    else return `https://invoice.acorp.app/signup?referral=${code}`;
}

/* Subscription amounts per currency (in smallest unit for consistency, but returned as base unit here) */
export function getSubscriptionAmount(currency: string): number {
    switch (currency.toUpperCase()) {
        case "NGN":
            return 9870; // ~9,870 NGN
        case "USD":
            return 7; // $7
        case "CAD":
            return 10; // $10 CAD
        default:
            return 9870;
    }
}
