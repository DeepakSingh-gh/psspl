"use client";
import { usePathname } from "next/navigation";

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
        <span>P</span>
        <div><strong>Progressive</strong><small>Surface Systems</small></div>
      </div>
      <nav>
        {NAV.map((item) => (
          <a key={item.href} href={item.href} className={isActive(item) ? "active" : undefined}>{item.label}</a>
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
