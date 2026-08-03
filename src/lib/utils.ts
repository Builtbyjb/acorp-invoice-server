import type { Context } from "hono";
import { ErrorResult, type TokenPayload } from "./types";
import type { InvoiceNumber, InvoiceItem } from "../api/v1/invoice/types";
import { getCookie } from "hono/cookie";
import { verify, sign } from "hono/jwt";
import { otpTemplate } from "@/templates/util";

export function getTokenFromHeader(c: Context): string | null {
    const auth_header_prefix = "Bearer ";

    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith(auth_header_prefix)) {
        return authHeader.slice(auth_header_prefix.length);
    }
    return null;
}

export function generateOTP(): string {
    const otp = (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000) + 10000000;
    return otp.toString();
}

export function getNewInvoiceNumber(invoiceNumber: InvoiceNumber): InvoiceNumber {
    let year = 0;
    let currentNumber = 0;

    if (getCurrentYear() > invoiceNumber.year) {
        year = getCurrentYear();
        currentNumber = 1;
    } else {
        year = invoiceNumber.year;
        currentNumber = invoiceNumber.currentNumber + 1;
    }

    return { year, currentNumber };
}

export async function decodeTokenValue(
    c: Context,
    token: string,
): Promise<TokenPayload | ErrorResult> {
    const secret = c.env.JWT_SECRET;
    if (!secret) {
        console.error("JWT secret not configured");
        return new ErrorResult("Internal Server Error", 500);
    }

    try {
        return (await verify(token, secret, "HS256")) as TokenPayload;
    } catch (error) {
        console.log(error);
        return new ErrorResult("Error verifying token", 403);
    }
}

export async function signToken(c: Context, payload: TokenPayload): Promise<Error | string> {
    const secret = c.env.JWT_SECRET;
    if (!secret) {
        console.error("JWT secret not configured");
        return new Error("Internal Server Error");
    }

    return await sign(payload, secret);
}

export async function sendOTPEmail(c: Context, email: string): Promise<Error | string> {
    // Generate a OTP
    const otp = generateOTP();
    const sender = c.env.OTP_EMAIL;
    if (!sender) {
        console.error("OTP_EMAIL not configured");
        return new Error("Sender not configured");
    }
    const htmlBody = fillTemplate(otpTemplate, { OTP_CODE: otp });

    // Send OTP to user email
    await c.env.SEND_EMAIL.send({
        from: `ACorp Invoice <${sender}>`,
        to: email,
        subject: "Your OTP code",
        html: htmlBody,
        text: `Your one time passcode is: ${otp}`,
    });

    return otp;
}

export function getBlobURL(c: Context, key: string): string {
    return `${c.env.SERVER_URL}/api/v1/invoice/blobs/${key}`;
}

export function handleZodValidate(result: any, c: Context) {
    if (!result.success) {
        console.error(`Zod Validation Error: ${result.error}`);
        return c.json({ message: "Zod Validation Error" }, 400);
    }
}

export function fillTemplate(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
        (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
        template,
    );
}

export function getCurrentYear(): number {
    return new Date().getFullYear();
}

export function calculateTotalAmount(
    items: InvoiceItem[],
    taxRate: number,
    discount: number,
): number {
    const subtotal = calculateSubTotal(items);
    const taxAmount = calculateTaxAmount(subtotal, taxRate);
    const discountAmount = calculateDiscount(subtotal, discount);
    return subtotal + taxAmount - discountAmount;
}

export function calculateTaxAmount(subtotal: number, taxRate: number): number {
    return subtotal * (taxRate / 100);
}

export function calculateDiscount(subtotal: number, discount: number): number {
    return subtotal * (discount / 100);
}

export function calculateSubTotal(items: InvoiceItem[]): number {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}
