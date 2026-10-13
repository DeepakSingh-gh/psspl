"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, clearSession, rmApi } from "@/lib/api";
import { formatRupees, formatNumber } from "@/lib/format";

/* ── helpers ── */
function monthsAgoLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (diff <= 0) return "This month";
  return `${diff} month${diff !== 1 ? "s" : ""} ago`;
}
function monthsAgoColor(dateStr: string | null | undefined): string {
  if (!dateStr) return "#d13a3a";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (diff <= 2) return "#e07c2d";
  if (diff <= 4) return "#c44a4a";
  return "#b03030";
}
function joinedLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `Joined ${d.toLocaleString("en-IN", { month: "short" })} ${d.getFullYear()}`;
}

const NAV_ITEMS = [
  { href: "/rm", label: "Dashboard" },
  { href: "/rm/team", label: "RM Reports" },
  { href: "/rm/customers", label: "Customers" },
  { href: "/rm/report-card", label: "Report Card" },
  { href: "/rm/products", label: "Field Activity" },
  { href: "/rm/alerts", label: "Follow-ups" },
  { href: "/rm/products", label: "Products" },
  { href: "/sales/my-day", label: "Reports" },
];

/* ─────────────── main component ─────────────── */
export function RmReportCard() {
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
    rmApi.reportCard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  /* computed */
  const target = data?.monthlyTarget ?? 0;
  const actual = data?.salesValue ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const isUnderperforming = pct < 50;
  const remaining = Math.max(0, target - actual);

  const fa = data?.fieldActivity ?? {};
  const pl = data?.pipeline ?? {};
  const topDealers: any[] = data?.topDealers ?? [];
  const dormantDealers: any[] = data?.dormantDealers ?? [];
  const allProducts: any[] = data?.topProducts ?? [];
  const topProducts = allProducts.slice(0, 5);

  /* product share */
  const productTotal = allProducts.reduce((s: number, p: any) => s + p.salesValue, 0) || 1;

  return (
    <div className="admin-shell rm-shell" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">P</span>
          <span className="admin-brand-name"><strong>PSSPL</strong><small>Distribution for Growth</small></span>
        </div>
        <p className="admin-workspace">Regional Manager</p>
        <nav>
          <div className="admin-nav-group">
            {NAV_ITEMS.map((item) => (
              <a key={item.href + item.label} className={item.href === "/rm/report-card" && item.label === "Report Card" ? "active" : ""} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>
        <div className="admin-user">
          <span aria-hidden="true">{data?.profile?.fullName?.slice(0, 1) ?? "R"}</span>
          <span className="admin-user-name">
            <strong>{data?.profile?.fullName ?? "Regional Manager"}</strong>
            <small>{data?.profile?.email}</small>
          </span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>

        {/* Tally sync badge */}
        <div style={{ marginTop: "auto", padding: "12px 8px 0", borderTop: "1px solid rgba(255,255,255,.10)", fontSize: "11px", color: "rgba(160,200,230,.7)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <span>Data from <strong>Tally</strong></span>
          </div>
          <div style={{ marginTop: 4 }}>
            Sales data synced<br />
            {data?.tallySync ? new Date(data.tallySync).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="admin-main">
        <div className="admin-content" style={{ padding: "0 28px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "28px 0 20px" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, color: "#0b2a5b", letterSpacing: "-.02em" }}>RM Report Card</h1>
              <p style={{ margin: "4px 0 0", color: "#5d7898", fontSize: "13.5px" }}>Complete view of RM&apos;s sales, activity, customers and next action</p>
            </div>
            {/* RM badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #d9e5ef", borderRadius: 10, padding: "8px 16px", boxShadow: "0 1px 4px rgba(11,42,91,.07)" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#087cc1,#0b2a5b)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                {data?.profile?.fullName?.slice(0, 1) ?? "R"}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0b2a5b" }}>{data?.profile?.fullName ?? "Loading…"}</span>
            </div>
          </div>

          {error && <div className="admin-error">{error}</div>}
          {loading && !data && <div className="admin-placeholder" style={{ padding: "60px 0", textAlign: "center" }}>Loading Report Card…</div>}

          {data && (
            <>
              {/* ── Profile + Performance Status banner ── */}
              <div style={{ background: "#fff", border: "1px solid #d9e5ef", borderRadius: 14, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(11,42,91,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#087cc1 0%,#0b2a5b 100%)", display: "grid", placeItems: "center", color: "#fff", fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                    {data.profile?.fullName?.slice(0, 1) ?? "R"}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0b2a5b" }}>{data.profile?.fullName ?? "—"}</h2>
                    <p style={{ margin: "3px 0 0", color: "#5d7898", fontSize: 13 }}>RM – {data.profile?.region ?? "—"}</p>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "#5d7898" }}>
                      <span>📍 {data.profile?.territory ?? data.profile?.region ?? "—"}</span>
                      <span>📅 {joinedLabel(data.profile?.joinedAt)}</span>
                    </div>
                  </div>
                </div>
                {/* Performance Status Badge Card */}
                <div
                  style={{
                    background: isUnderperforming
                      ? "linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)"
                      : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                    border: `1px solid ${isUnderperforming ? "#fca5a5" : "#86efac"}`,
                    borderRadius: 12,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: isUnderperforming
                      ? "0 2px 8px rgba(220,38,38,0.08)"
                      : "0 2px 8px rgba(22,163,74,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: isUnderperforming ? "#dc2626" : "#16a34a",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff",
                      boxShadow: isUnderperforming
                        ? "0 4px 10px rgba(220,38,38,0.25)"
                        : "0 4px 10px rgba(22,163,74,0.25)",
                      flexShrink: 0,
                    }}
                  >
                    {isUnderperforming ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: ".06em",
                          color: isUnderperforming ? "#991b1b" : "#166534",
                        }}
                      >
                        Performance Status
                      </span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: isUnderperforming ? "#991b1b" : "#166534", lineHeight: 1.2, marginTop: 1 }}>
                      {isUnderperforming ? "Underperforming" : "On Track"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isUnderperforming ? "#b91c1c" : "#15803d",
                        marginTop: 2,
                      }}
                    >
                      {pct}% of monthly target achieved
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 6 KPI cards ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
                <KpiCard icon="🎯" iconBg="#eaf5fc" label="Monthly Target" value={formatRupees(target)} />
                <KpiCard icon="📊" iconBg="#e8f7ee" label="Actual Sales" value={formatRupees(actual)} />
                {/* Achievement */}
                <div style={kpiCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff3e0", display: "grid", placeItems: "center", fontSize: 14 }}>%</span>
                    <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Achievement</span>
                  </div>
                  <strong style={{ fontSize: 22, fontWeight: 800, color: isUnderperforming ? "#d13a3a" : "#1f7a55" }}>{pct}%</strong>
                  <div style={{ marginTop: 6, height: 5, borderRadius: 4, background: "#f0f0f0", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: isUnderperforming ? "#d13a3a" : "#1f7a55", borderRadius: 4, transition: "width .5s" }} />
                  </div>
                </div>
                {/* Customers Visited */}
                <div style={kpiCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eaf5fc", display: "grid", placeItems: "center", fontSize: 14 }}>👥</span>
                    <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Customers Visited</span>
                  </div>
                  <strong style={{ fontSize: 22, fontWeight: 800, color: "#0b2a5b" }}>{formatNumber(fa.visitsCompleted)}</strong>
                  <small style={{ fontSize: 11, color: "#5d7898" }}>of {formatNumber(fa.visitsTotal)} planned</small>
                </div>
                <KpiCard icon="📞" iconBg="#fff3e0" label="Calls Logged" value={formatNumber(fa.callsLogged)} />
                {/* Follow-ups */}
                <div style={kpiCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fef2f2", display: "grid", placeItems: "center", fontSize: 14 }}>🔔</span>
                    <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Follow-ups Pending</span>
                  </div>
                  <strong style={{ fontSize: 22, fontWeight: 800, color: "#d13a3a" }}>{formatNumber(fa.followUpsOpen)}</strong>
                  {fa.followUpsOverdue > 0 && <small style={{ fontSize: 11, color: "#d13a3a", fontWeight: 600 }}>{fa.followUpsOverdue} overdue</small>}
                </div>
              </div>

              {/* ── Row 2: Sales chart + Field Activity + Pipeline ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* Sales vs Target */}
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>📈 Sales vs Target (This Month)</p>
                  
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Target Achievement</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isUnderperforming ? "#dc2626" : "#16a34a" }}>
                        {pct}% <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>({formatRupees(actual)})</span>
                      </span>
                    </div>
                    
                    {/* Visual Progress Bar */}
                    <div style={{ height: 12, width: "100%", background: "#f1f5f9", borderRadius: 8, overflow: "hidden", border: "1px solid #cbd5e1" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(1, pct))}%`,
                          background: isUnderperforming
                            ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
                            : "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)",
                          borderRadius: 8,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Target: </span>
                        <strong style={{ color: "#0f172a", fontWeight: 800 }}>{formatRupees(target)}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 600 }}>Actual: </span>
                        <strong style={{ color: "#0284c7", fontWeight: 800 }}>{formatRupees(actual)}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: ".04em" }}>Remaining to Target</span>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#991b1b", marginTop: 1 }}>{formatRupees(remaining)}</div>
                    </div>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                  </div>
                </div>

                {/* Field Activity */}
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>🚶 Field Activity (This Month)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                    <FieldStat
                      icon="🚶"
                      value={formatNumber(fa.visitsCompleted)}
                      label={
                        <>
                          Visits<br />
                          <span style={{ fontSize: 10, color: "#8a9eb5" }}>
                            ({fa.visitsTotal > 0 ? Math.round((fa.visitsCompleted / fa.visitsTotal) * 100) : 0}% of plan)
                          </span>
                        </>
                      }
                      color="#1f7a55"
                    />
                    <FieldStat icon="📞" value={formatNumber(fa.callsLogged)} label={<>Calls</>} color="#087cc1" />
                    <FieldStat icon="👥" value={formatNumber(fa.uniqueCustomers)} label={<>Unique<br />Customers</>} color="#7c3aed" />
                  </div>
                </div>

                {/* Pipeline */}
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>🛒 Pipeline (Expected Orders)</p>
                  <strong style={{ fontSize: 22, fontWeight: 800, color: "#0b2a5b", display: "block", marginTop: 8 }}>{formatRupees(pl.totalValue)}</strong>
                  <small style={{ color: "#5d7898", fontSize: 12 }}>Total pipeline value</small>
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <PipelineBadge label="High" count={pl.high?.count ?? 0} color="#e8f7ee" textColor="#1f7a55" />
                    <PipelineBadge label="Medium" count={pl.medium?.count ?? 0} color="#fff7e0" textColor="#b5762a" />
                    <PipelineBadge label="Low" count={pl.low?.count ?? 0} color="#eaf5fc" textColor="#087cc1" />
                  </div>
                </div>
              </div>

              {/* ── Row 3: Tables ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* Top 5 Dealers */}
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>👤 Top 5 Dealers by Revenue (This Month)</p>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: "#5d7898" }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Dealer Name</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Sales Value</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>% Share</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {topDealers.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: "center", color: "#5d7898", padding: "16px 0" }}>No sales this month</td></tr>
                      ) : topDealers.map((d: any, i: number) => (
                        <tr key={i} style={{ borderTop: "1px solid #f0f4f8" }}>
                          <td style={{ padding: "7px 4px", color: "#5d7898" }}>{i + 1}</td>
                          <td style={{ padding: "7px 4px", fontWeight: 600, color: "#0b2a5b" }}>{d.dealerName}</td>
                          <td style={{ padding: "7px 4px", textAlign: "right", color: "#0b2a5b" }}>{formatRupees(d.salesValue)}</td>
                          <td style={{ padding: "7px 4px", textAlign: "right", color: "#5d7898" }}>{d.pctShare}%</td>
                          <td style={{ padding: "7px 4px", width: 60 }}>
                            <div style={{ height: 5, borderRadius: 3, background: "#f0f4f8" }}>
                              <div style={{ height: "100%", width: `${d.pctShare}%`, background: "#087cc1", borderRadius: 3 }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Dormant Dealers */}
                <div style={cardStyle}>
                  <p style={cardTitleStyle}>🕐 Dormant Dealers</p>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: "#5d7898" }}>
                        <th style={thStyle}>Dealer Name</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Last Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dormantDealers.length === 0 ? (
                        <tr><td colSpan={2} style={{ textAlign: "center", color: "#1f7a55", padding: "16px 0", fontWeight: 600 }}>✓ No dormant dealers</td></tr>
                      ) : dormantDealers.map((d: any, i: number) => (
                        <tr key={i} style={{ borderTop: "1px solid #f0f4f8" }}>
                          <td style={{ padding: "8px 4px", fontWeight: 600, color: "#0b2a5b" }}>{d.dealerName}</td>
                          <td style={{ padding: "8px 4px", textAlign: "right" }}>
                            <span style={{ background: monthsAgoColor(d.lastInvoice) + "22", color: monthsAgoColor(d.lastInvoice), borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                              {monthsAgoLabel(d.lastInvoice)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Product Performance (Top 5) */}
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>📦 Product Performance (Top 5)</p>
                    {allProducts.length > 5 && (
                      <a
                        href="/rm/products"
                        style={{ textDecoration: "none", background: "#e0f2fe", color: "#0369a1", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}
                      >
                        View All ({allProducts.length}) →
                      </a>
                    )}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ color: "#475569" }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Product</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Sales Value</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>No product sales this month</td></tr>
                      ) : topProducts.map((p: any, i: number) => (
                        <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 4px", color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: "8px 4px", fontWeight: 700, color: "#0f172a" }}>{p.productName}</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>{formatRupees(p.salesValue)}</td>
                          <td style={{ padding: "8px 4px", width: 60 }}>
                            <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.round((p.salesValue / productTotal) * 100)}%`, background: "linear-gradient(90deg, #7c3aed, #6d28d9)", borderRadius: 4 }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>


            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── sub-components ── */
function KpiCard({ icon, iconBg, label, value }: { icon: string; iconBg: string; label: string; value: string }) {
  return (
    <div style={kpiCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: "grid", placeItems: "center", fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>{label}</span>
      </div>
      <strong style={{ fontSize: 20, fontWeight: 800, color: "#0b2a5b" }}>{value}</strong>
    </div>
  );
}

function FieldStat({ icon, value, label, color }: { icon: string; value: string; label: React.ReactNode; color: string }) {
  return (
    <div style={{ textAlign: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <strong style={{ display: "block", fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{value}</strong>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 4, lineHeight: 1.2, textAlign: "center", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function PipelineBadge({ label, count, color, textColor }: { label: string; count: number; color: string; textColor: string }) {
  return (
    <div style={{ flex: 1, background: color, border: `1px solid ${textColor}33`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
      <strong style={{ fontSize: 20, fontWeight: 800, color: textColor, display: "block" }}>{count}</strong>
      <span style={{ fontSize: 11, color: textColor, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ── shared styles ── */
const cardStyle: React.CSSProperties = {
  background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: "18px",
  boxShadow: "0 2px 8px rgba(15,23,42,.06)",
};
const cardTitleStyle: React.CSSProperties = {
  margin: 0, fontSize: 13.5, fontWeight: 750, color: "#0f172a",
  paddingBottom: 8, borderBottom: "1px solid #f1f5f9",
};
const kpiCardStyle: React.CSSProperties = {
  background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: "16px",
  boxShadow: "0 2px 8px rgba(15,23,42,.06)",
};
const thStyle: React.CSSProperties = {
  padding: "7px 6px", fontWeight: 700, textAlign: "left", fontSize: 11, color: "#475569", background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1",
};
