"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavigationOpener, NavigationClose, NavigationBackdrop, useMobileNavigation } from "@/components/common/mobile-navigation";
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
  const navigation = useMobileNavigation(pathname, 680);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "S";

  const isActive = (item: (typeof NAV)[number]) => pathname === item.href;

  return (
    <>
    <div className="sales-mobile-bar"><NavigationOpener navigation={navigation} id="sales-navigation" /><span>PSSPL CRM</span></div>
    <NavigationBackdrop navigation={navigation} />
    <aside className={`sales-sidebar${navigation.open ? " is-open" : ""}`} id="sales-navigation" {...navigation.drawerProps}>
      <div className="brand">
        <PssplLogo width={170} /><NavigationClose navigation={navigation} />
      </div>
      <nav>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? "active" : undefined} aria-current={isActive(item) ? "page" : undefined}>{item.label}</Link>
        ))}
        <Link href="/profile" className={pathname === "/profile" ? "active" : undefined} aria-current={pathname === "/profile" ? "page" : undefined}>Profile</Link>
      </nav>
      <div className="user-card">
        <span>{initials}</span>
        <div><strong>{name}</strong><small>{subtitle}</small></div>
        <button type="button" className="logout" onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
    </>
  );
}
