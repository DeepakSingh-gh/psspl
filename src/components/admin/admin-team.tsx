"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatFinancialYear, formatNumber, formatPercent, formatRupees } from "@/lib/format";

function getTrafficLightStatus(percent: number | null) {
  if (percent === null) return { light: "⚪", text: "No Target" };
  if (percent < 50) return { light: "🔴", text: "Needs Attention" };
  if (percent <= 80) return { light: "🟡", text: "Average" };
  return { light: "🟢", text: "Good" };
}

export function AdminTeam() {
  const [financialYear, setFinancialYear] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { data, loading, error, reload } = useAdminData(() => adminApi.team(financialYear || undefined), [financialYear], `admin-team-${financialYear || "default"}`);

  const sortedMembers = data ? [...data.members].sort((a, b) => {
    const aVal = a.achievementPercent !== null ? a.achievementPercent : a.salesValue;
    const bVal = b.achievementPercent !== null ? b.achievementPercent : b.salesValue;
    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  }) : [];

  return (
    <AdminPage
      eyebrow="Team performance"
      title="Sales team performance"
      description="Live Tally sales are matched to each salesperson or regional manager through the customer owner saved in the CRM."
      actions={
        data && data.financialYears.length > 0 ? (
          <>
            <label className="admin-select">
              <span>Sort performance</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}>
                <option value="asc">Poor to good</option>
                <option value="desc">Good to poor</option>
              </select>
            </label>
            <label className="admin-select">
              <span>Financial year</span>
              <select value={financialYear || data.financialYear || ""} onChange={(event) => setFinancialYear(event.target.value)}>
                {data.financialYears.map((year) => <option key={year} value={year}>{formatFinancialYear(year)}</option>)}
              </select>
            </label>
          </>
        ) : null
      }
    >
      <AdminState loading={loading} error={error} onRetry={reload} empty={false}>
        {data && (
          <>
            {data.liveInvoiceCount === 0 && (
              <p className="admin-note">CRM users are ready. Sales will appear here as soon as the connector sends Tally invoices; no sample figures are shown.</p>
            )}
            {!data.hasTargets && (
              <p className="admin-note">No monthly targets are set in Users &amp; access, so achievement remains blank.</p>
            )}
            {data.unassignedCustomers > 0 && (
              <p className="admin-note subtle">
                {formatNumber(data.unassignedCustomers)} Tally customers are not assigned to a salesperson or RM yet. Their sales remain unassigned instead of being credited to the wrong person.
              </p>
            )}
            {data.unassignedSalesValue > 0 && <p className="admin-note subtle">Unassigned Tally sales for this year: {formatRupees(data.unassignedSalesValue)}.</p>}

            <p className="admin-note subtle">Click on any RM or salesperson name to view their detailed sales activity — visits, pipeline, and actual sales.</p>

            {/* ── Thrust Products Leaderboard Widget ── */}
            {data.thrustLeaderboard && data.thrustLeaderboard.length > 0 && (
              <div
                style={{
                  background: "linear-gradient(135deg, #f0fdf4 0%, #ecfeff 50%, #f8fafc 100%)",
                  border: "1.5px solid #86efac",
                  borderRadius: 16,
                  padding: "20px 22px",
                  marginBottom: 24,
                  boxShadow: "0 4px 16px -2px rgba(22, 101, 52, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: "1px solid rgba(134, 239, 172, 0.4)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 18,
                        color: "#fff",
                        boxShadow: "0 3px 8px rgba(22, 163, 74, 0.3)",
                      }}
                    >
                      🚀
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                          Strategic Thrust Products — RM Leaderboard
                        </h3>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "#dcfce7",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          9 Key Thrust Products
                        </span>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                        Tracking actual sales till date against the annual thrust portfolio (Rs. Lac)
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #bbf7d0",
                      borderRadius: 10,
                      padding: "6px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Thrust Revenue</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>
                        ₹{data.thrustLeaderboard.reduce((s, m) => s + m.thrustSalesLakh, 0).toFixed(2)} Lac
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top RM Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {data.thrustLeaderboard.slice(0, 4).map((item, idx) => {
                    const medals = ["🥇", "🥈", "🥉", "🎖️"];
                    return (
                      <Link
                        key={item.id}
                        href={`/admin/team/${encodeURIComponent(item.id)}`}
                        style={{
                          textDecoration: "none",
                          background: "#ffffff",
                          border: idx === 0 ? "1.5px solid #facc15" : "1px solid #e2e8f0",
                          borderRadius: 12,
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          boxShadow: idx === 0 ? "0 4px 12px rgba(234, 179, 8, 0.15)" : "0 2px 6px rgba(0,0,0,0.03)",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 5 }}>
                            <span>{medals[idx]}</span>
                            <span>{item.name}</span>
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: "#f0fdf4",
                              color: "#166534",
                            }}
                          >
                            {item.thrustActiveCount} products
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#16a34a" }}>
                            {item.thrustSalesLakh.toFixed(2)} <span style={{ fontSize: 11, fontWeight: 700 }}>Lac</span>
                          </div>
                          {item.thrustTopProduct && (
                            <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                              Top: <strong style={{ color: "#334155" }}>{item.thrustTopProduct}</strong>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Salesperson / RM</th>
                    <th className="numeric">Sales</th>
                    <th className="numeric" style={{ color: "#15803d" }}>🎯 Thrust Sales</th>
                    <th className="numeric">Target</th>
                    <th className="numeric">Achieved</th>
                    <th className="numeric">Vs last year</th>
                    <th className="numeric">Customers</th>
                    <th className="numeric">Outstanding</th>
                    <th>Top product</th>
                    <th>CRM activity</th>
                    <th>CRM account</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <Link href={`/admin/team/${encodeURIComponent(member.id)}`} className="rm-name-link" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                          {(() => {
                            const status = getTrafficLightStatus(member.achievementPercent);
                            const badgeStyles = {
                              '🔴': { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
                              '🟡': { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
                              '🟢': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
                              '⚪': { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' }
                            }[status.light] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };

                            return (
                              <>
                                <span style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>
                                  {status.light} {member.name}
                                </span>
                                {member.achievementPercent !== null ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: badgeStyles.bg,
                                    color: badgeStyles.text,
                                    border: `1px solid ${badgeStyles.border}`,
                                    width: 'fit-content'
                                  }}>
                                    {formatPercent(member.achievementPercent)} Target Achieved → {status.text}
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: badgeStyles.bg,
                                    color: badgeStyles.text,
                                    border: `1px solid ${badgeStyles.border}`,
                                    width: 'fit-content'
                                  }}>
                                    {status.text}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </Link>
                        <small>
                          {member.crmUser?.role === "salesperson" ? "CRM salesperson" : `${member.salespeopleCount} salespeople`}
                          {member.aliases.length > 0 && <> · also spelled {member.aliases.join(", ")}</>}
                        </small>
                      </td>
                      <td className="numeric">{formatRupees(member.salesValue)}</td>
                      <td className="numeric">
                        {member.thrustSalesLakh && member.thrustSalesLakh > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <span style={{ fontWeight: 800, color: "#166534" }}>
                              {member.thrustSalesLakh.toFixed(2)} L
                            </span>
                            <small style={{ color: "#64748b", fontSize: 10.5 }}>
                              {member.thrustActiveCount} product{member.thrustActiveCount !== 1 ? "s" : ""}
                            </small>
                          </div>
                        ) : (
                          <span className="admin-muted">—</span>
                        )}
                      </td>
                      <td className="numeric">{member.targetValue > 0 ? <>{formatRupees(member.targetValue)}<small>{formatRupees(member.monthlyTargetValue)} / month · {data.targetMonths} months</small></> : <span className="admin-muted">Not set</span>}</td>
                      <td className="numeric">
                        {member.achievementPercent === null
                          ? <span className="admin-muted">—</span>
                          : <span className={`admin-pill ${member.achievementPercent >= 100 ? "positive" : member.achievementPercent < 50 ? "negative" : "neutral"}`}>{formatPercent(member.achievementPercent)}</span>}
                      </td>
                      <td className="numeric">
                        {member.growthPercent === null
                          ? <span className="admin-muted">—</span>
                          : <span className={member.growthPercent >= 0 ? "tone-positive" : "tone-negative"}>{member.growthPercent >= 0 ? "+" : ""}{formatPercent(member.growthPercent)}</span>}
                      </td>
                      <td className="numeric">{formatNumber(member.customerCount)}</td>
                      <td className="numeric">{formatRupees(member.outstanding)}</td>
                      <td>{member.topProduct ? <><strong className="admin-cell-title">{member.topProduct.name}</strong><small>{formatRupees(member.topProduct.salesValue)}</small></> : <span className="admin-muted">—</span>}</td>
                      <td>
                        <strong className="admin-cell-title">{member.visitsCompleted}/{member.visitsTotal} visits</strong>
                        <small>
                          {member.followUpsOpen} open follow-ups ·{" "}
                          {member.checkOutAt ? (
                            <span style={{ color: "#166534", fontWeight: 700 }}>
                              Out: {new Date(member.checkOutAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          ) : member.checkInAt ? (
                            <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
                              In: {new Date(member.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          ) : member.checkedInToday ? (
                            <span style={{ color: "#1d4ed8" }}>Checked in today</span>
                          ) : (
                            "Not checked in today"
                          )}
                        </small>
                      </td>
                      <td>
                        {member.crmUser
                          ? <><strong className="admin-cell-title">{member.crmUser.email}</strong><small>{member.crmUser.active ? "Active" : "Deactivated"} · {member.crmUser.role}</small></>
                          : <span className="admin-muted">No account</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminState>
    </AdminPage>
  );
}
