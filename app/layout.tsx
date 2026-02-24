import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "./lib/AuthContext"

export const metadata: Metadata = {
  title: "Sales Conversation Dashboard — Frostrek LLP",
  description: "CRM-style support conversation dashboard powered by Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
