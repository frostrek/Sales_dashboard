"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
    email: string
    name: string
    role: string
}

interface AuthContextType {
    user: User | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        async function loadUser() {
            try {
                // In a production app, we would have an API to get the current user session
                // For now, we'll try to get it from a local check or just let middleware handle it
                // and have the login page refresh the state.
                // However, since we want a "useAuth" hook, we can fetch from a session endpoint.
                const res = await fetch("/api/auth/session")
                if (res.ok) {
                    const data = await res.json()
                    setUser(data.user)
                } else {
                    setUser(null)
                }
            } catch (err) {
                setUser(null)
            } finally {
                setLoading(false)
            }
        }
        loadUser()
    }, [])

    const signOut = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" })
            setUser(null)
            router.push("/login")
            router.refresh()
        } catch (err) {
            console.error("Logout failed:", err)
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
