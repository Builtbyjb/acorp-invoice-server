import type { Invoice } from "@/lib/types";
import { calculateTotalAmount, getCurrentYear } from "@/lib/utils";

export function calculateRevenue(invoices: Invoice[]): number {
    let totalRevenue = 0;

    for (const invoice of invoices) {
        if (invoice.status === "paid") {
            const totalAmount = calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
            totalRevenue += totalAmount;
        }
    }

    return totalRevenue;
}

export function countPaidInvoices(invoices: Invoice[]): number {
    const paidInvoices: Invoice[] = invoices.filter((i) => i.status === "paid");
    return paidInvoices.length;
}

export function countPendingInvoices(invoices: Invoice[]): number {
    const pendingInvoices: Invoice[] = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
    return pendingInvoices.length;
}

export function getInvoiceData(invoices: Invoice[]): { status: string; count: number }[] {
    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const sentInvoices = invoices.filter((i) => i.status === "sent");
    const draftInvoices = invoices.filter((i) => i.status === "draft");
    const overdueInvoices = invoices.filter((i) => i.status === "overdue");

    return [
        { status: "paid", count: paidInvoices.length },
        { status: "sent", count: sentInvoices.length },
        { status: "draft", count: draftInvoices.length },
        { status: "overdue", count: overdueInvoices.length },
    ];
}

export function getMonthlyRevenues(invoices: Invoice[]): { month: string; revenue: number }[] {
    let janRev = 0;
    let febRev = 0;
    let marRev = 0;
    let aprRev = 0;
    let mayRev = 0;
    let junRev = 0;
    let julRev = 0;
    let augRev = 0;
    let sepRev = 0;
    let octRev = 0;
    let novRev = 0;
    let decRev = 0;

    invoices.forEach((invoice) => {
        if (invoice.issueDate.getFullYear() !== getCurrentYear()) return;
        const month = invoice.issueDate.getMonth();
        switch (month) {
            case 0:
                janRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 1:
                febRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 2:
                marRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 3:
                aprRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 4:
                mayRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 5:
                junRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 6:
                julRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 7:
                augRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 8:
                sepRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 9:
                octRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 10:
                novRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
            case 11:
                decRev += calculateTotalAmount(invoice.items, invoice.taxRate, invoice.discount);
                break;
        }
    });

    return [
        { month: "Jan", revenue: janRev },
        { month: "Feb", revenue: febRev },
        { month: "Mar", revenue: marRev },
        { month: "Apr", revenue: aprRev },
        { month: "May", revenue: mayRev },
        { month: "Jun", revenue: junRev },
        { month: "Jul", revenue: julRev },
        { month: "Aug", revenue: augRev },
        { month: "Sep", revenue: sepRev },
        { month: "Oct", revenue: octRev },
        { month: "Nov", revenue: novRev },
        { month: "Dec", revenue: decRev },
    ];
}

export function getRecentInvoices(invoices: Invoice[]): Invoice[] {
    const recentInvoices = invoices.filter(
        (invoice) =>
            invoice.issueDate.getMonth() === new Date().getMonth() ||
            invoice.issueDate.getMonth() === new Date().getMonth() - 1,
    );

    const sortedInvoices = recentInvoices.sort((a, b) => a.issueDate.getMonth() - b.issueDate.getMonth());

    return sortedInvoices.slice(0, 10);
}
