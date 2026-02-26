import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
    "/login(.*)",
    "/sign-up(.*)",
    "/unauthorized(.*)",
    "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
        await auth.protect({
            unauthenticatedUrl: new URL("/login", request.url).toString(),
        });
    }
});

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
