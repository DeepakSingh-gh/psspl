import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./insights.css";
import "./hub.css";
import "./admin.css";
import { Inter } from "next/font/google";
import { RefreshDataButton } from "@/components/common/refresh-data-button";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "PSSPL CRM",
  description: "Progressive Surface Systems CRM",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={inter.variable}><body style={{ fontFamily: "var(--font-inter, Inter, 'Segoe UI', Arial, sans-serif)" }}>{children}<RefreshDataButton /></body></html>;
}

