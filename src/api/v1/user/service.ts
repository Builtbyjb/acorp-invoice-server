import type { MonthlyRevenue } from "@/lib/types";
import type { Invoice } from "@/lib/invoice/types";
import { calculateTotalAmount } from "@/lib/utils";

export function getMonthlyRevenues(
    invoices: Invoice[],
    year: number,
    currency: string,
): MonthlyRevenue[] {
    const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];
    const revenues = new Array(12).fill(0);

    invoices.forEach((invoice) => {
        if (invoice.status !== "paid" || invoice.currency !== currency || !invoice.paymentDate)
            return;

        const paymentDate = new Date(invoice.paymentDate);
        if (paymentDate.getFullYear() !== year) return;

        const month = paymentDate.getMonth();
        revenues[month] += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
    });

    return monthNames.map((month, index) => ({ month, amount: revenues[index] }));
}
