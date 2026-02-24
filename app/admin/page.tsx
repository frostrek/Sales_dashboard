"use client"

import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/AuthContext"
import { useRouter } from "next/navigation"

export default function AdminPage() {
    const { profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<"admin" | "sales">("sales")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const [profiles, setProfiles] = useState<any[]>([])

    useEffect(() => {
        if (!authLoading && (!profile || profile.role !== "admin")) {
            router.push("/")
        } else if (profile?.role === "admin") {
            fetchProfiles()
        }
    }, [profile, authLoading, router])

    async function fetchProfiles() {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .order("email", { ascending: true })

        if (data) setProfiles(data)
    }

    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        // Note: In a real production app, you would use a Supabase Edge Function or 
        // a server-side route using the Admin Auth API to create the user without 
        // sending them an invite email immediately if desired.
        // For this prototype, we'll demonstrate the invitation flow.

        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: { role: role }
        })

        if (error) {
            setMessage({ type: "error", text: error.message })
        } else {
            setMessage({ type: "success", text: `Invitation sent to ${email}!` })
            setEmail("")
            fetchProfiles()
        }
        setLoading(false)
    }

    if (authLoading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>

    return (
        <div className="min-h-screen p-8 lg:p-12" style={{ background: "#0a1120", color: "#fff" }}>
            <div className="max-w-6xl mx-auto">
                <header className="mb-12 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">Admin Management</h1>
                        <p className="text-slate-400">Manage your sales organization and accounts</p>
                    </div>
                    <button
                        onClick={() => router.push("/")}
                        className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                        Back to Dashboard
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Add User Form */}
                    <div
                        className="lg:col-span-1 p-8 rounded-[32px] h-fit sticky top-8"
                        style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            backdropFilter: "blur(20px)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                    >
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm">＋</span>
                            Invite New Member
                        </h2>

                        <form onSubmit={handleAddUser} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Work Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-indigo-500/50 transition-all"
                                    placeholder="name@company.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Role</label>
                                <div className="flex gap-2">
                                    {(["sales", "admin"] as const).map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setRole(r)}
                                            className={`flex-1 py-3 rounded-xl border font-semibold transition-all capitalize ${role === r
                                                    ? "bg-indigo-600 border-indigo-500 text-white"
                                                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {message && (
                                <div className={`p-4 rounded-xl text-sm border ${message.type === "success"
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-red-500/10 border-red-500/20 text-red-400"
                                    }`}>
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 disabled:opacity-50 transition-all"
                            >
                                {loading ? "Sending..." : "Send Invitation"}
                            </button>
                        </form>
                    </div>

                    {/* User List */}
                    <div className="lg:col-span-2">
                        <div
                            className="rounded-[32px] overflow-hidden"
                            style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                backdropFilter: "blur(20px)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                            }}
                        >
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="px-8 py-5 text-sm font-medium text-slate-400">Member</th>
                                        <th className="px-8 py-5 text-sm font-medium text-slate-400">Role</th>
                                        <th className="px-8 py-5 text-sm font-medium text-slate-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {profiles.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-12 text-center text-slate-500">
                                                No team members found
                                            </td>
                                        </tr>
                                    ) : (
                                        profiles.map((p) => (
                                            <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-slate-300">
                                                            {p.email?.[0].toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-slate-200">{p.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${p.role === "admin" ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-500/20 text-slate-400"
                                                        }`}>
                                                        {p.role}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                        Active
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
