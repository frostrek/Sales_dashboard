"use client"

import { useClerk } from "@clerk/nextjs"
import { useEffect, useRef } from "react"
import Link from "next/link"

export default function UnauthorizedPage() {
    const { signOut } = useClerk()
    const signedOut = useRef(false)

    // Auto sign-out unauthorized users
    useEffect(() => {
        if (!signedOut.current) {
            signedOut.current = true
            signOut({ redirectUrl: "/unauthorized" })
        }
    }, [signOut])

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: "#060912" }}
        >
            {/* Background decorative elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-600/10 blur-[120px] rounded-full"></div>
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]"
                    style={{
                        backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                ></div>
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-md text-center px-6">
                {/* Icon */}
                <div
                    className="mb-6"
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: "22px",
                        background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 40,
                        boxShadow: "0 20px 40px -10px rgba(220, 38, 38, 0.5)",
                    }}
                >
                    🚫
                </div>

                {/* Title */}
                <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
                    Access Denied
                </h1>

                {/* Message */}
                <p className="text-slate-300 text-lg font-medium mb-2">
                    Access restricted to Frostrek employees only.
                </p>
                <p className="text-slate-500 text-sm mb-8">
                    Only accounts with a <span className="text-indigo-400 font-semibold">@frostrek.com</span> email address
                    are authorized to use this application.
                </p>

                {/* Back to login */}
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm transition-all duration-200"
                    style={{
                        background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
                        boxShadow: "0 8px 24px -6px rgba(79, 70, 229, 0.5)",
                    }}
                >
                    ← Back to Login
                </Link>

                <p className="mt-10 text-slate-600 text-xs font-medium">
                    Frostrek LLP &copy; 2026. Authorized Access Only.
                </p>
            </div>
        </div>
    )
}
