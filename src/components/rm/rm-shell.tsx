"use client";
import { useEffect, useState } from "react";
import { NavigationOpener, NavigationClose, NavigationBackdrop, useMobileNavigation } from "@/components/common/mobile-navigation";
import { useRouter } from "next/navigation";
import { authApi, clearSession, rmApi } from "@/lib/api";
import { PssplLogo } from "@/components/common/psspl-logo";

const NAV_ITEMS = [
  { href: "/rm", label: "Home" },
  { href: "/rm/team", label: "My Team" },
  { href: "/rm/report-card", label: "Report Card" },
  { href: "/rm/customers", label: "Customers" },
  { href: "/rm/products", label: "Product Trends" },
  { href: "/rm/alerts", label: "Alerts" },
  { href: "/sales/my-day", label: "My Day" },
];

interface Props { children: React.ReactNode; activeHref: string; }

export function RmShell({ children, activeHref }: Props) {
  const router = useRouter();
  const navigation = useMobileNavigation(activeHref);
  const [manager, setManager] = useState<{ fullName: string; region: string } | null>(null);

  useEffect(() => {
    authApi.me()
      .then(({ user }) => { if (user.role !== "rm") router.replace(user.role === "admin" ? "/admin" : "/sales/my-day"); })
      .catch(() => { clearSession(); router.replace("/login"); });
    rmApi.dashboard().then((d) => setManager(d.manager)).catch(() => {});
  }, [router]);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  return (
    <div className={`admin-shell rm-shell${navigation.open ? " nav-open" : ""}`}>
      <NavigationBackdrop navigation={navigation} />
      <aside className="admin-sidebar" id="rm-navigation" {...navigation.drawerProps}>
        <div className="admin-brand">
          <PssplLogo /><NavigationClose navigation={navigation} />
        </div>
        <p className="admin-workspace">Regional manager workspace</p>
        <nav>
          <div className="admin-nav-group">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} className={item.href === activeHref ? "active" : ""} aria-current={item.href === activeHref ? "page" : undefined} href={item.href}>
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
          <a href="/profile">Profile</a>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div className="admin-main" data-navigation-content><div className="rm-mobile-bar"><NavigationOpener navigation={navigation} id="rm-navigation" /><span>Regional manager workspace</span></div>{children}</div>
    </div>
  );
}
