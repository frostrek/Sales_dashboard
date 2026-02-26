import { clerkMiddleware } from "@clerk/nextjs/server";

// clerkMiddleware() WITHOUT auth.protect() — just attaches Clerk auth context.
// auth.protect() crashes on Vercel Edge with Next.js 16, so route protection
// is handled client-side in page.tsx and domain enforcement in layout.tsx.
export default clerkMiddleware();

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
