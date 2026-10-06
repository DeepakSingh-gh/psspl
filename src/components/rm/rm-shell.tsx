"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, clearSession, rmApi } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/rm", label: "Home" },
  { href: "/rm/report-card", label: "Report Card" },
  { href: "/rm/team", label: "My Team" },
  { href: "/rm/customers", label: "Customers" },
  { href: "/rm/products", label: "Product Trends" },
  { href: "/rm/alerts", label: "Alerts" },
  { href: "/sales/my-day", label: "My Day" },
];

interface Props { children: React.ReactNode; activeHref: string; }

export function RmShell({ children, activeHref }: Props) {
  const router = useRouter();
  const [manager, setManager] = useState<{ fullName: string; region: string } | null>(null);

  useEffect(() => {
    authApi.me()
      .then(({ user }) => { if (user.role !== "rm") router.replace(user.role === "admin" ? "/admin" : "/sales/my-day"); })
      .catch(() => { clearSession(); router.replace("/login"); });
    rmApi.dashboard().then((d) => setManager(d.manager)).catch(() => {});
  }, [router]);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  return (
    <div className="admin-shell rm-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">P</span>
          <span className="admin-brand-name"><strong>Progressive</strong><small>Surface Systems</small></span>
        </div>
        <p className="admin-workspace">Regional manager workspace</p>
        <nav>
          <div className="admin-nav-group">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} className={item.href === activeHref ? "active" : ""} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>
        <div className="admin-user">
          <span aria-hidden="true">{manager?.fullName?.slice(0, 1) ?? "R"}</span>
          <span className="admin-user-name">
            <strong>{manager?.fullName ?? "Regional Manager"}</strong>
            <small>{manager?.region}</small>
          </span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
