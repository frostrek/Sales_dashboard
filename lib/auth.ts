import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-at-least-32-chars-long-frostrek";
const key = new TextEncoder().encode(JWT_SECRET);

export const SESSION_COOKIE_NAME = "frostrek_session";
export const SESSION_EXPIRY = 8 * 60 * 60; // 8 hours in seconds

export interface SessionPayload {
    email: string;
    name: string;
    role: string;
    expiresAt: Date;
}

export function validateEmail(email: string): boolean {
    // Only allow emails ending with @frostrek.com
    // Email format must be first.last@frostrek.com
    const regex = /^[a-zA-Z]+\.[a-zA-Z]+@frostrek\.com$/;
    return regex.test(email);
}

export function validatePassword(email: string, password: string): boolean {
    // Password must match: First 4 letters of first name + @123
    // Example: arghya.choudhury@frostrek.com -> Password: Argh@123
    const parts = email.split("@")[0].split(".");
    if (parts.length < 1) return false;

    const firstName = parts[0];
    const expectedPrefix = firstName.substring(0, 4).charAt(0).toUpperCase() + firstName.substring(1, 4).toLowerCase();
    const expectedPassword = `${expectedPrefix}@123`;

    return password === expectedPassword;
}

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ["HS256"],
    });
    return payload;
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!session) return null;
    return await decrypt(session);
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!session) return;

    // Refresh the session so it doesn't expire
    const parsed = await decrypt(session);
    parsed.expires = new Date(Date.now() + SESSION_EXPIRY * 1000);
    const res = NextResponse.next();
    res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: await encrypt(parsed),
        httpOnly: true,
        expires: parsed.expires,
    });
}
