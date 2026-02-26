"use client"

/**
 * Stub auth context — Clerk has been removed.
 * Returns a hardcoded admin user so the rest of the app works unchanged.
 */
export function useAuth() {
    const user = {
        email: "admin@frostrek.com",
        name: "Admin",
        role: "admin" as string,
    }

    return {
        user,
        profile: user,
        loading: false,
        signOut: async () => {
            // No-op: auth removed
        },
    }
}

// Keep the old export name alive so existing imports still resolve
export { useAuth as AuthProvider }
