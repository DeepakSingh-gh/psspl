import type { ReactNode } from "react";

/**
 * Dedicated, standalone layout for the RM Report Card print/download page.
 * This intentionally bypasses the AdminShell (sidebar, topbar, Ask AI bar)
 * so the printed PDF is clean — no navigation chrome, no localhost URLs, no AI widget.
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
