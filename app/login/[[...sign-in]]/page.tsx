"use client"

import { SignIn } from "@clerk/nextjs"

export default function LoginPage() {
    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: "#060912" }}
        >
            {/* Background decorative elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]"
                    style={{
                        backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                ></div>
            </div>

            <div className="relative z-10 flex flex-col items-center">
                {/* Brand header */}
                <div className="flex flex-col items-center mb-8">
                    <div
                        className="mb-6"
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: "22px",
                            background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            color: "#fff",
                            fontSize: 32,
                            boxShadow: "0 20px 40px -10px rgba(79, 70, 229, 0.5)",
                        }}
                    >
                        F
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                        Frostrek
                    </h1>
                    <p className="text-slate-400 text-center font-medium text-sm">
                        Internal Dashboard Authentication
                    </p>
                </div>

                <SignIn
                    signUpUrl="/sign-up"
                    fallbackRedirectUrl="/"
                />

                <p className="mt-8 text-center text-slate-500 text-sm font-medium">
                    Frostrek LLP &copy; 2026. Authorized Access Only.
                </p>
            </div>
        </div>
    )
}
