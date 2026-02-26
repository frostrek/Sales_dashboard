import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
    "/login(.*)",
    "/sign-up(.*)",
    "/unauthorized(.*)",
    "/api/webhooks(.*)",
]);

const ALLOWED_DOMAIN = "@frostrek.com";

export default clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
        const { userId } = await auth.protect({
            unauthenticatedUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/login',
        });

        // Fetch full user record and validate email domain
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const email = user.emailAddresses
            .find((e) => e.id === user.primaryEmailAddressId)
            ?.emailAddress;

        if (!email || !email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
            const unauthorizedUrl = new URL("/unauthorized", request.url);
            return NextResponse.redirect(unauthorizedUrl);
        }
    }
});

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
