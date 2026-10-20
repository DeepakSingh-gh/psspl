"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, clearSession, rmApi } from "@/lib/api";
import { PssplLogo } from "@/components/common/psspl-logo";
import { formatRupees, formatNumber } from "@/lib/format";

const STAGE_LABELS: Record<string, string> = {
  lead: "New Lead", technical_discussion: "Tech Discussion", sample: "Sample",
  quotation: "Quotation", follow_up: "Follow-up", expected_order: "Expected Order", won: "Won", lost: "Lost",
};
const STAGE_ORDER = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"];

const NAV_ITEMS = [
  { href: "/rm", label: "Home" },
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
          <PssplLogo />
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
                {/* ── RM Executive Identity Banner ── */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid #cbd5e1",
                    borderRadius: 16,
                    padding: "18px 22px",
                    marginBottom: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                    boxShadow: "0 2px 10px rgba(15,23,42,.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #0b2a5b 0%, #087cc1 100%)",
                        display: "grid",
                        placeItems: "center",
                        color: "#fff",
                        fontSize: 20,
                        fontWeight: 800,
                        flexShrink: 0,
                        boxShadow: "0 4px 10px rgba(11,42,91,.2)",
                      }}
                    >
                      {data.manager?.fullName?.slice(0, 1) ?? "R"}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                          {data.manager?.fullName ?? "Regional Manager"}
                        </h2>
                        {data.manager?.rmCode && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#1d4ed8",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 750,
                            }}
                          >
                            🏷️ RM Code: <strong style={{ color: "#1e40af" }}>{data.manager?.rmCode}</strong>
                          </span>
                        )}
                        <span
                          style={{
                            background: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            color: "#334155",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          Region: {data.manager?.region ?? "Not configured"}
                        </span>
                        <span
                          style={{
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            color: "#1d4ed8",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 700,
                          }}
                        >
                          📍 Area: {[data.manager?.region, data.manager?.territory].filter(Boolean).join(" / ") || "Not configured"}
                        </span>
                      </div>

                      {/* Active sales territories */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          👥 Team territories:
                        </span>
                        {(data.manager?.teamTerritories || []).map((city: string, i: number) => (
                          <span
                            key={i}
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              color: "#0f172a",
                              padding: "1px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {city}
                          </span>
                        ))}
                      </div>

                      {/* RM Clock-in / Clock-out Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 10px",
                          borderRadius: 16,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: data.manager?.attendance?.checkOutAt
                            ? "#f0fdf4"
                            : data.manager?.attendance?.checkInAt
                            ? "#eff6ff"
                            : "#f8fafc",
                          color: data.manager?.attendance?.checkOutAt
                            ? "#166534"
                            : data.manager?.attendance?.checkInAt
                            ? "#1d4ed8"
                            : "#64748b",
                          border: `1px solid ${
                            data.manager?.attendance?.checkOutAt
                              ? "#bbf7d0"
                              : data.manager?.attendance?.checkInAt
                              ? "#bfdbfe"
                              : "#e2e8f0"
                          }`,
                        }}>
                          <span style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: data.manager?.attendance?.checkOutAt
                              ? "#16a34a"
                              : data.manager?.attendance?.checkInAt
                              ? "#2563eb"
                              : "#94a3b8",
                          }} />
                          {data.manager?.attendance?.checkOutAt
                            ? `Clocked Out: ${new Date(data.manager.attendance.checkOutAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
                            : data.manager?.attendance?.checkInAt
                            ? `Clocked In: ${new Date(data.manager.attendance.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
                            : "Not Clocked In Today"}
                        </span>
                        {data.manager?.attendance?.checkInAt && data.manager?.attendance?.checkOutAt && (
                          <span style={{
                            fontSize: 11,
                            color: "#64748b",
                            fontWeight: 600,
                            background: "#f1f5f9",
                            padding: "2px 7px",
                            borderRadius: 6,
                          }}>
                            In: {new Date(data.manager.attendance.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

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
                          <td>{m.attendance ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span className={`admin-pill ${m.attendance.checkOutAt ? "positive" : "neutral"}`} style={{ width: "fit-content" }}>
                                {m.attendance.checkOutAt ? "Checked out" : "In field"}
                              </span>
                              <small style={{ fontSize: 10.5, color: "#64748b" }}>
                                In: <strong>{new Date(m.attendance.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong>
                                {m.attendance.checkOutAt && (
                                  <> · Out: <strong>{new Date(m.attendance.checkOutAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong></>
                                )}
                              </small>
                            </div>
                          ) : (
                            <span className="admin-muted">Not checked in</span>
                          )}
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
