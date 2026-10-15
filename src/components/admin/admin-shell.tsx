"use client";
import { ReactNode, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, hasSession } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import type { SessionUser } from "@/types/admin";
import { HeaderAiAsk } from "./admin-ask-ai";
import { PssplLogo } from "@/components/common/psspl-logo";

/** One line-glyph vocabulary for the whole rail — same weight, same 16px box. */
const ICONS: Record<string, ReactNode> = {
  overview: <><rect x="2" y="2.5" width="5" height="5" rx="1" /><rect x="9" y="2.5" width="5" height="5" rx="1" /><rect x="2" y="9.5" width="5" height="4" rx="1" /><rect x="9" y="9.5" width="5" height="4" rx="1" /></>,
  team: <><circle cx="6" cy="5" r="2.2" /><path d="M2 13c0-2.2 1.8-3.5 4-3.5S10 10.8 10 13" /><circle cx="12" cy="5.6" r="1.6" /><path d="M11 9.8c1.7 0 3 1 3 3.2" /></>,
  customers: <><rect x="2" y="3" width="12" height="10.5" rx="1.5" /><path d="M2 6.5h12M6 6.5v7" /></>,
  products: <><path d="M8 2 14 5.2v5.6L8 14 2 10.8V5.2Z" /><path d="M2 5.2 8 8.4l6-3.2M8 8.4V14" /></>,
  trends: <><path d="M2 11.5 6 7l3 2.5L14 4" /><path d="M10.5 4H14v3.5" /></>,
  field: <><path d="M8 14s4.6-4 4.6-7.4A4.6 4.6 0 0 0 8 2a4.6 4.6 0 0 0-4.6 4.6C3.4 10 8 14 8 14Z" /><circle cx="8" cy="6.4" r="1.7" /></>,
  alerts: <><path d="M8 2.5a3.8 3.8 0 0 0-3.8 3.8c0 3-1.2 4-1.2 4h10s-1.2-1-1.2-4A3.8 3.8 0 0 0 8 2.5Z" /><path d="M6.6 12.4a1.6 1.6 0 0 0 2.8 0" /></>,
  reports: <><path d="M4 2h5l3 3v9H4Z" /><path d="M9 2v3h3" /><path d="M6 9h4M6 11.2h3" /></>,
  management: <><rect x="2" y="2.5" width="12" height="11" rx="1.5" /><path d="M5 10.5V7M8 10.5V5M11 10.5V8.5" /></>,
  users: <><circle cx="8" cy="5.2" r="2.4" /><path d="M3 13.2c0-2.5 2.2-4 5-4s5 1.5 5 4" /></>,
  tally: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M5 6h6M5 8.4h6M5 10.8h3.5" /></>,
  audit: <><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.2 1.5" /></>,
};

/** Every destination stays reachable; the rail just reads as two sections. */
const NAV_GROUPS = [
  {
    label: "Admin console",
    items: [{ href: "/admin", label: "Overview", icon: "overview" }],
  },
  {
    label: "Sales intelligence",
    items: [
      { href: "/admin/team", label: "Team performance", icon: "team" },
      { href: "/admin/customers", label: "Customers", icon: "customers" },
      { href: "/admin/products", label: "Products", icon: "products" },
      { href: "/admin/trends", label: "Product trends", icon: "trends" },
    ],
  },
  {
    label: "Field operations",
    items: [
      { href: "/admin/activity", label: "Field activity", icon: "field", alsoMatches: ["/admin/alerts"] },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "reports" },
      { href: "/admin/management-reports", label: "Management reports", icon: "management" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "Users & access", icon: "users" },
      { href: "/admin/tally", label: "Tally data", icon: "tally" },
      { href: "/admin/audit", label: "Audit log", icon: "audit" },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [denied, setDenied] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // The API authorises every admin request; this only decides what to render.
  useEffect(() => {
    if (!hasSession()) { router.replace("/login"); return; }
    let cancelled = false;
    authApi.me()
      .then((result) => {
        if (cancelled) return;
        if (result.user.role !== "admin") { setDenied(true); return; }
        setUser(result.user);
      })
      .catch((cause) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) { clearSession(); router.replace("/login"); return; }
        setDenied(true);
      });
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  if (denied) {
    return (
      <main className="admin-gate">
        <div>
          <p className="admin-eyebrow">Restricted area</p>
          <h1>Admin access required</h1>
          <p>This account does not have permission to open the admin console.</p>
          <div className="admin-gate-actions">
            <Link className="admin-button" href="/sales/my-day">Go to my day</Link>
            <button type="button" className="admin-button ghost" onClick={signOut}>Sign in as someone else</button>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return <main className="admin-gate"><div><span className="admin-gate-spinner" aria-hidden="true" />
      <p>Checking your access…</p></div></main>;
  }

  return (
    <div className={`admin-shell${navOpen ? " nav-open" : ""}`}>
      {navOpen && <div className="admin-sidebar-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <PssplLogo />
        </div>
        <p className="admin-workspace">Tally + CRM intelligence</p>
        <nav>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <p className="admin-sidebar-label">{group.label}</p>
              {group.items.map((item) => {
                const extra = (item as { alsoMatches?: string[] }).alsoMatches ?? [];
                const active = item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href) || extra.some((path) => pathname.startsWith(path));
                return (
                  <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONS[item.icon]}
                    </svg>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="admin-user">
          <span aria-hidden="true">{initialsOf(user.email.split("@")[0].replace(/[._]/g, " "), "A")}</span>
          <span className="admin-user-name">
            <strong>{user.email}</strong>
            <small>Administrator</small>
          </span>
        </div>
      </aside>

      <div className="admin-main">
        <AdminTopBar user={user} onSignOut={signOut} onToggleNav={() => setNavOpen((open) => !open)} navOpen={navOpen} />
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

/** Application bar: global search & AI Ask, alerts, who is signed in, sign out. */
function AdminTopBar({ user, onSignOut, onToggleNav, navOpen }: {
  user: SessionUser;
  onSignOut: () => void;
  onToggleNav: () => void;
  navOpen: boolean;
}) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="admin-nav-toggle"
        onClick={onToggleNav}
        aria-expanded={navOpen}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
      >
        {navOpen ? (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        )}
      </button>

      <HeaderAiAsk />

      <div className="topbar-right">
        <Link className="topbar-icon" href="/admin/alerts" aria-label="Alerts">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 2.5a3.8 3.8 0 0 0-3.8 3.8c0 3-1.2 4-1.2 4h10s-1.2-1-1.2-4A3.8 3.8 0 0 0 8 2.5Z" />
            <path d="M6.6 12.4a1.6 1.6 0 0 0 2.8 0" />
          </svg>
        </Link>
        <Link className="topbar-user" href="/admin/users">
          <span className="topbar-avatar" aria-hidden="true">{initialsOf(user.email.split("@")[0].replace(/[._]/g, " "), "A")}</span>
          <span className="topbar-user-text">
            <strong>Administrator</strong>
            <small>{user.email}</small>
          </span>
        </Link>
        <button type="button" className="topbar-signout" onClick={onSignOut}>Sign out</button>
      </div>
    </header>
  );
}

export function AdminPage({ eyebrow, title, description, actions, children }: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-heading">
          <p className="admin-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {description && <p className="admin-page-description">{description}</p>}
        </div>
        {actions && <div className="admin-page-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** A titled band of the page, so the dashboard reads as a narrative instead of a wall of cards. */
export function AdminSection({ eyebrow, title, description, action, children }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-section">
      <header className="admin-section-header">
        <div>
          <p className="admin-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, tone, icon, progress, emphasis }: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
  /** Small monochrome glyph shown beside the label. */
  icon?: ReactNode;
  /** 0–100; renders a hairline progress track under the value. */
  progress?: number | null;
  emphasis?: boolean;
}) {
  return (
    <article className={`admin-stat${emphasis ? " is-emphasis" : ""}`}>
      <span className="admin-stat-label">
        {icon && <i className="admin-stat-icon" aria-hidden="true">{icon}</i>}
        {label}
      </span>
      <strong className={tone ? `tone-${tone}` : undefined}>{value}</strong>
      {progress !== null && progress !== undefined && (
        <span className={`admin-stat-progress${tone ? ` tone-${tone}` : ""}`}>
          <span style={{ width: `${Math.max(Math.min(progress, 100), 0)}%` }} />
        </span>
      )}
      {sub && <small>{sub}</small>}
    </article>
  );
}

export function AdminState({ loading, error, empty, children, onRetry }: {
  loading: boolean;
  error: string;
  empty?: boolean;
  children: ReactNode;
  onRetry?: () => void;
}) {
  if (loading) return <div className="admin-placeholder"><span className="admin-gate-spinner" aria-hidden="true" />Loading…</div>;
  if (error) {
    return (
      <div className="admin-error" role="alert">
        <span>{error}</span>
        {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  if (empty) return <div className="admin-placeholder">Nothing to show yet.</div>;
  return <>{children}</>;
}
