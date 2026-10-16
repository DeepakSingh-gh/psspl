"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PssplLogo } from "@/components/common/psspl-logo";

const NAV = [
  { href: "/sales/my-day", label: "My Day" },
  { href: "/sales/hub", label: "Customer DB" },
];

/**
 * The salesperson rail. Deliberately two entries: the hub has its own tab strip
 * for pipeline, requests, alerts and reports, so repeating them here is noise.
 */
export function SalesSidebar({ name, subtitle, onSignOut }: {
  name: string;
  subtitle: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "S";

  const isActive = (item: (typeof NAV)[number]) => pathname === item.href;

  return (
    <aside className="sales-sidebar">
      <div className="brand">
        <PssplLogo width={170} />
      </div>
      <nav>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? "active" : undefined}>{item.label}</Link>
        ))}
      </nav>
      <div className="user-card">
        <span>{initials}</span>
        <div><strong>{name}</strong><small>{subtitle}</small></div>
        <button type="button" className="logout" onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
  );
}
