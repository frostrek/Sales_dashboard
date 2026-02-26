import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// No-op middleware — Clerk auth has been removed.
// Just pass all requests through.
export function middleware(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    ],
};
