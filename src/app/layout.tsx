import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./insights.css";
import "./hub.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "PSSPL CRM",
  description: "Progressive Surface Systems CRM",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}

