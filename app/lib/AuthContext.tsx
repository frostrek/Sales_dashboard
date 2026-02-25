"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

const ALLOWED_DOMAIN = "@frostrek.com"

/**
 * Compatibility wrapper around Clerk's hooks.
 * Provides the same `useAuth()` interface the rest of the app expects,
 * so we don't have to touch every consumer at once.
 *
 * Also enforces @frostrek.com email restriction client-side
 * as a defense-in-depth measure (middleware is the primary gate).
 */
export function useAuth() {
    const { user, isLoaded, isSignedIn } = useUser()
    const { signOut: clerkSignOut } = useClerk()
    const router = useRouter()
    const hasCheckedDomain = useRef(false)

    const email = user?.primaryEmailAddress?.emailAddress ?? ""
    const isAllowedDomain = email.toLowerCase().endsWith(ALLOWED_DOMAIN)

    // Client-side domain enforcement
    useEffect(() => {
        if (isLoaded && isSignedIn && !hasCheckedDomain.current) {
            hasCheckedDomain.current = true
            if (!isAllowedDomain) {
                clerkSignOut({ redirectUrl: "/unauthorized" })
            }
        }
    }, [isLoaded, isSignedIn, isAllowedDomain, clerkSignOut])

    const signOut = async () => {
        await clerkSignOut()
        router.push("/login")
    }

    // Build a user-like object matching the old shape
    const profile = isLoaded && isSignedIn && user && isAllowedDomain
        ? {
            email,
            name: user.fullName ?? user.firstName ?? "",
            role: (user.publicMetadata?.role as string) ?? "sales",
        }
        : null

    return {
        user: profile,
        profile, // admin page uses `profile`
        loading: !isLoaded,
        signOut,
    }
}

// Keep the old export name alive so existing imports still resolve
export { useAuth as AuthProvider }

