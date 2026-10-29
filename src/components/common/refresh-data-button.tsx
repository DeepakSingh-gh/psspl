"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type RefreshRequest = CustomEvent<{ tasks: Promise<unknown>[] }>;

/** Refreshes the active route's data loaders without remounting the page. */
export function RefreshDataButton({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  if (pathname === "/login" || pathname === "/") return null;
  // RM report owns an inline toolbar control; other routes retain their existing button.
  if (!inline && (/^\/admin\/team\/[^/]+\/?$/.test(pathname) || pathname === '/rm/report-card')) return null;

  async function refresh() {
    setRefreshing(true);
    const tasks: Promise<unknown>[] = [];
    const request = new CustomEvent("psspl:refresh-data", { detail: { tasks } }) as RefreshRequest;
    window.dispatchEvent(request);
    router.refresh();
    try {
      await Promise.allSettled(tasks);
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  }

  return (
    <button
      type="button"
      className={inline ? "rm-v3-refresh-button" : "page-refresh-button"}
      onClick={refresh}
      disabled={refreshing}
      aria-label="Refresh data on this page"
      aria-busy={refreshing}
      title="Fetch the latest data without reloading the page"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M6.1 7a7 7 0 0 1 11.55-1.6L20 8M4 16l2.35 2.6A7 7 0 0 0 17.9 17" />
      </svg>
      <span>{refreshing ? "Refreshing…" : "Refresh Data"}</span>
    </button>
  );
}
