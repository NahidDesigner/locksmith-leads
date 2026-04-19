import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Locksmith — Leads Dashboard",
  description: "Centralized Elementor form submissions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-slate-100 font-sans">{children}</body>
    </html>
  );
}
