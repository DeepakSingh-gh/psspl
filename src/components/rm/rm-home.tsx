"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, clearSession, rmApi } from "@/lib/api";
import { formatRupees, formatNumber } from "@/lib/format";

const STAGE_LABELS: Record<string, string> = {
  lead: "New Lead", technical_discussion: "Tech Discussion", sample: "Sample",
  quotation: "Quotation", follow_up: "Follow-up", expected_order: "Expected Order", won: "Won", lost: "Lost",
};
const STAGE_ORDER = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"];

const NAV_ITEMS = [
  { href: "/rm", label: "Home" },
  { href: "/rm/report-card", label: "Report Card" },
  { href: "/rm/team", label: "My Team" },
  { href: "/rm/customers", label: "Customers" },
  { href: "/rm/products", label: "Product Trends" },
  { href: "/rm/alerts", label: "Alerts" },
  { href: "/sales/my-day", label: "My Day" },
];

export function RmHome() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authApi.me()
      .then(({ user }) => { if (user.role !== "rm") router.replace(user.role === "admin" ? "/admin" : "/sales/my-day"); })
      .catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  useEffect(() => {
    rmApi.dashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  const pipeline = STAGE_ORDER.map((s) => data?.pipeline?.find((p: any) => p.stage === s) ?? { stage: s, count: 0, expectedValue: 0 });
  const maxCount = Math.max(1, ...pipeline.map((p: any) => p.count));

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
              <a key={item.href} className={item.href === "/rm" ? "active" : ""} href={item.href}>{item.label}</a>
            ))}
          </div>
        </nav>
        <div className="admin-user">
          <span aria-hidden="true">{data?.manager?.fullName?.slice(0, 1) ?? "R"}</span>
          <span className="admin-user-name">
            <strong>{data?.manager?.fullName ?? "Regional Manager"}</strong>
            <small>{data?.manager?.region}</small>
          </span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-content">
          <section className="admin-page">
            <header className="admin-page-header">
              <div className="admin-page-heading">
                <p className="admin-eyebrow">Regional Manager</p>
                <h1>Dashboard</h1>
                <p className="admin-page-description">
                  {data ? `Your team: ${data.members?.length ?? 0} member${data.members?.length !== 1 ? "s" : ""}. Financial year to date.` : "Loading…"}
                </p>
              </div>
            </header>

            {error && <div className="admin-error">{error}</div>}

            {loading && !data ? (
              <div className="admin-placeholder">Loading your dashboard…</div>
            ) : data && (
              <>
                <div className="admin-stats">
                  <article className="admin-stat">
                    <span className="admin-stat-label">Team Sales</span>
                    <strong>{formatRupees(data.summary.salesValue)}</strong>
                    <small>{data.from} to {data.to}</small>
                  </article>
                  <article className="admin-stat">
                    <span className="admin-stat-label">Customers</span>
                    <strong>{formatNumber(data.summary.customers)}</strong>
                    <small>Across your team</small>
                  </article>
                  <article className="admin-stat">
                    <span className="admin-stat-label">Outstanding</span>
                    <strong>{formatRupees(data.summary.outstanding)}</strong>
                    <small>Total owed</small>
                  </article>
                  <article className="admin-stat">
                    <span className="admin-stat-label">Visits</span>
                    <strong>{formatNumber(data.summary.visitsCompleted)} <em className="admin-stat-of">of {formatNumber(data.summary.visitsTotal)}</em></strong>
                    <small>{formatNumber(data.summary.followUpsOpen)} open follow-ups</small>
                  </article>
                </div>

                <div className="admin-section-label" style={{ marginTop: "2rem", marginBottom: "0.75rem", fontWeight: 600, fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Lead Pipeline by Stage
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
                  {pipeline.map((p: any) => (
                    <div key={p.stage} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-2)" }}>{STAGE_LABELS[p.stage]}</span>
                      <div style={{ height: "8px", background: "var(--color-surface-2)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((p.count / maxCount) * 100)}%`, background: "var(--color-accent)", borderRadius: "4px", transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-2)", textAlign: "right" }}>
                        {p.count} {p.count === 1 ? "lead" : "leads"}{p.expectedValue > 0 ? ` · ${formatRupees(p.expectedValue)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="admin-section-label" style={{ marginBottom: "0.75rem", fontWeight: 600, fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Team Check-in Status — Today
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Salesperson</th><th>Territory</th><th>Today</th><th>Visits</th><th>Follow-ups open</th></tr></thead>
                    <tbody>
                      {data.members.map((m: any) => (
                        <tr key={m.id}>
                          <td>
                            <strong className="admin-cell-title">{m.fullName}{m.isSelf ? <span className="rm-you"> (You)</span> : null}</strong>
                            <small>{m.email}</small>
                          </td>
                          <td>{m.territory}</td>
                          <td>{m.attendance
                            ? <><span className={`admin-pill ${m.attendance.checkOutAt ? "positive" : "neutral"}`}>{m.attendance.checkOutAt ? "Checked out" : "In field"}</span></>
                            : <span className="admin-muted">Not checked in</span>}
                          </td>
                          <td>{formatNumber(m.visitsCompleted)} of {formatNumber(m.visitsTotal)}</td>
                          <td>{formatNumber(m.followUpsOpen)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}>
                  {NAV_ITEMS.filter((n) => n.href !== "/rm").map((item) => (
                    <Link key={item.href} href={item.href} className="admin-button" style={{ textDecoration: "none" }}>
                      {item.label} →
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
