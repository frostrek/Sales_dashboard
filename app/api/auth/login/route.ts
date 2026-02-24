import { NextRequest, NextResponse } from "next/server";
import { encrypt, validateEmail, validatePassword, SESSION_COOKIE_NAME, SESSION_EXPIRY } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        if (!validateEmail(email)) {
            return NextResponse.json(
                { error: "Invalid email domain or format. Use first.last@frostrek.com" },
                { status: 400 }
            );
        }

        if (!validatePassword(email, password)) {
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Create session
        const parts = email.split("@")[0].split(".");
        const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "";

        const expires = new Date(Date.now() + SESSION_EXPIRY * 1000);
        const session = await encrypt({
            user: {
                email,
                name: `${firstName} ${lastName}`.trim(),
                role: "admin"
            },
            expires
        });

        const response = NextResponse.json({ success: true });

        response.cookies.set(SESSION_COOKIE_NAME, session, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            expires: expires,
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
