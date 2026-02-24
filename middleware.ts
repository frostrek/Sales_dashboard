import { NextRequest, NextResponse } from "next/server";
import { decrypt, SESSION_COOKIE_NAME } from "./lib/auth";

// Protected routes
const protectedRoutes = ["/", "/dashboard", "/admin"];
const apiProtectedRoutes = ["/api/tickets", "/api/users"];

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Check if the path is protected
    const isProtectedRoute = protectedRoutes.some(route => path === route || path.startsWith(`${route}/`));
    const isApiProtectedRoute = apiProtectedRoutes.some(route => path.startsWith(route));

    const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = cookie ? await decrypt(cookie).catch(() => null) : null;

    // Redirect to /login if not authenticated and trying to access protected route
    if ((isProtectedRoute || isApiProtectedRoute) && !session) {
        if (path === "/login") return NextResponse.next();

        // For API routes, return 401
        if (path.startsWith("/api/")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.redirect(new URL("/login", request.nextUrl));
    }

    // Redirect to / if authenticated and trying to access /login
    if (path === "/login" && session) {
        return NextResponse.redirect(new URL("/", request.nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (auth API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
    ],
};
