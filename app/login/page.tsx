"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const [email, setEmail] = useState("arghya.choudhury@frostrek.com")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Invalid login credentials");
            } else {
                router.push("/");
                router.refresh();
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#060912" }}>
            {/* Background decorative elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
            </div>

            <div
                className="relative z-10 w-full max-w-md p-10 rounded-[40px]"
                style={{
                    background: "rgba(10, 15, 30, 0.7)",
                    backdropFilter: "blur(40px)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow: "0 40px 80px -20px rgba(0, 0, 0, 0.8)"
                }}
            >
                <div className="flex flex-col items-center mb-10">
                    <div
                        className="mb-8"
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: "24px",
                            background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            color: "#fff",
                            fontSize: 36,
                            boxShadow: "0 20px 40px -10px rgba(79, 70, 229, 0.5)",
                            position: "relative",
                            overflow: "hidden"
                        }}
                    >
                        F
                        <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-0 hover:opacity-100 transition-opacity"></div>
                    </div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">Frostrek</h1>
                    <p className="text-slate-400 text-center font-medium">Internal Dashboard Authentication</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-7">
                    <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2.5 ml-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4.5 rounded-2xl bg-white/5 border border-white/10 text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
                            placeholder="first.last@frostrek.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2.5 ml-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-6 py-4.5 rounded-2xl bg-white/5 border border-white/10 text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-600"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                {error}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-lg hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] active:scale-[0.98] transition-all relative overflow-hidden group"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-3">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Authenticating...
                            </span>
                        ) : (
                            "Sign In"
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    </button>
                </form>

                <p className="mt-10 text-center text-slate-500 text-sm font-medium">
                    Frostrek LLP &copy; 2026. Authorized Access Only.
                </p>
            </div>
        </div>
    )
}
