import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Sales Conversation Dashboard — Frostrek LLP",
  description: "CRM-style support conversation dashboard powered by Supabase",
};

const ALLOWED_DOMAIN = "@frostrek.com";
const PUBLIC_PATHS = ["/login", "/sign-up", "/unauthorized"];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get current path to check if it's public
  const headersList = await headers();
  const domain = headersList.get("host") || "";
  const fullUrl = headersList.get("referer") || "";
  const isPublic = PUBLIC_PATHS.some(path => fullUrl.includes(path));

  // Server-side authentication and email domain enforcement (Node.js runtime)
  const user = await currentUser();

  if (!user && !isPublic) {
    redirect("/login");
  }

  if (user) {
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;
    if (!email || !email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      redirect("/unauthorized");
    }
  }
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          colorBackground: "#111827",
          colorText: "#f1f5f9",
          colorTextSecondary: "#94a3b8",
          colorInputBackground: "#1e293b",
          colorInputText: "#f1f5f9",
          colorNeutral: "#64748b",
          borderRadius: "14px",
          fontFamily: "inherit",
        },
        elements: {
          card: {
            background: "rgba(17, 24, 39, 0.95)",
            backdropFilter: "blur(40px)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            boxShadow:
              "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            borderRadius: "28px",
            padding: "8px",
          },
          rootBox: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          },
          headerTitle: {
            color: "#fff",
            fontWeight: "800",
            fontSize: "22px",
          },
          headerSubtitle: {
            color: "#94a3b8",
          },
          formFieldLabel: {
            color: "#cbd5e1",
            fontWeight: "600",
            fontSize: "13px",
          },
          formFieldInput: {
            background: "#1e293b",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#f1f5f9",
            borderRadius: "12px",
            fontSize: "15px",
          },
          formButtonPrimary: {
            background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
            fontWeight: "700",
            fontSize: "15px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px -6px rgba(79, 70, 229, 0.5)",
          },
          socialButtonsBlockButton: {
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#e2e8f0",
            borderRadius: "12px",
          },
          socialButtonsBlockButtonText: {
            color: "#e2e8f0",
            fontWeight: "600",
          },
          dividerLine: {
            background: "rgba(255,255,255,0.08)",
          },
          dividerText: {
            color: "#64748b",
          },
          footerActionLink: {
            color: "#818cf8",
            fontWeight: "600",
          },
          footerActionText: {
            color: "#64748b",
          },
          identityPreviewText: {
            color: "#e2e8f0",
          },
          identityPreviewEditButton: {
            color: "#818cf8",
          },
          formResendCodeLink: {
            color: "#818cf8",
          },
          alertText: {
            color: "#fca5a5",
          },
          formFieldSuccessText: {
            color: "#86efac",
          },
          formFieldErrorText: {
            color: "#fca5a5",
          },
        },
      }}
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
