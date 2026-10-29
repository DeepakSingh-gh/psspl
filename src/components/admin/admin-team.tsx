"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { prefetchAdminData, useAdminData } from "@/lib/use-admin-data";
import { reportDateRange } from "@/lib/business-date";
import { formatFinancialYear, formatNumber, formatPercent, formatRupees } from "@/lib/format";
import { rankRmPerformance, teamPerformanceMetric } from "@/lib/admin-performance";

function getTrafficLightStatus(percent: number | null) {
  if (percent === null) return { light: "⚪", text: "No Target" };
  if (percent < 50) return { light: "🔴", text: "Needs Attention" };
  if (percent <= 80) return { light: "🟡", text: "Average" };
  return { light: "🟢", text: "Good" };
}

export function AdminTeam() {
  const router = useRouter();
  const [financialYear, setFinancialYear] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { data, loading, error, reload } = useAdminData(() => adminApi.team(financialYear || undefined), [financialYear], `admin-team-${financialYear || "default"}`, true);

  const sortedMembers = data ? rankRmPerformance(data.members, sortOrder) : [];
  const sortMetric = teamPerformanceMetric(data?.members ?? []);
  const detailHref = (id: string) => `/admin/team/${encodeURIComponent(id)}${data?.financialYear ? `?fy=${encodeURIComponent(data.financialYear)}` : ""}`;
  const prepareDetail = (id: string) => {
    const { from, to } = reportDateRange("month");
    router.prefetch(detailHref(id));
    prefetchAdminData(`admin-rm-${id}-${from}-${to}-month`, () => adminApi.rmDetail(id, from, to, "month"));
  };

  return (
    <AdminPage
      eyebrow="Team performance"
      title="Sales team performance"
      description={data?.members.some(member => member.reportSource) ? "RM financial figures use the supplied PDF snapshots dated 30 September 2026. Customer ownership, outstanding and field activity use CRM records." : "Live Tally sales are matched to each salesperson or regional manager through the customer owner saved in the CRM."}
      actions={
        data && data.financialYears.length > 0 ? (
          <>
            <label className="admin-select">
              <span>Sort performance</span>
              <select aria-describedby="team-sort-basis" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "asc" | "desc")}>
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
            {data.liveInvoiceCount === 0 && !data.members.some(member => member.reportSource) && (
              <p className="admin-note">CRM users are ready. Sales will appear here as soon as the connector sends Tally invoices; no sample figures are shown.</p>
            )}
            {!data.hasTargets && (
              <p className="admin-note">No monthly targets are set in Users &amp; access, so achievement remains blank.</p>
             )}
            {/* ── Thrust Products Leaderboard Widget ── */}
            {data.thrustLeaderboard && data.thrustLeaderboard.length > 0 && (
              <div className="team-perf-leaderboard">
                <div className="team-perf-leaderboard-header">
                  <div className="team-perf-leaderboard-title">
                    <div className="team-perf-leaderboard-icon" aria-hidden="true">🚀</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 className="team-perf-leaderboard-heading">
                          Strategic Thrust Products — RM Leaderboard
                        </h3>
                        <span className="team-perf-leaderboard-badge">9 Key Thrust Products</span>
                      </div>
                      <p className="team-perf-leaderboard-sub">
                        Tracking actual sales till date against the annual thrust portfolio (Rs. Lac)
                      </p>
                    </div>
                  </div>

                  <div className="team-perf-leaderboard-total">
                    <div className="team-perf-leaderboard-total-label">Total Thrust Revenue</div>
                    <div className="team-perf-leaderboard-total-value">
                      ₹{data.thrustLeaderboard.reduce((s, m) => s + m.thrustSalesLakh, 0).toFixed(2)} Lac
                    </div>
                  </div>
                </div>

                {/* Top RM Cards */}
                <div className="team-perf-leaderboard-grid">
                  {data.thrustLeaderboard.slice(0, 4).map((item, idx) => {
                    const medals = ["🥇", "🥈", "🥉", "🎖️"];
                    return (
                      <Link
                        key={item.id}
                        href={detailHref(item.id)}
                        onMouseEnter={() => prepareDetail(item.id)}
                        onFocus={() => prepareDetail(item.id)}
                        className={`team-perf-rm-card${idx === 0 ? " team-perf-rm-card--gold" : ""}`}
                      >
                        <div className="team-perf-rm-card-header">
                          <span className="team-perf-rm-card-name">
                            <span aria-hidden="true">{medals[idx]}</span>
                            {item.name}
                          </span>
                          <span className="team-perf-rm-card-tag">
                            {item.thrustActiveCount == null ? "PDF total" : `${item.thrustActiveCount} products`}
                          </span>
                        </div>
                        <div className="team-perf-rm-card-value">
                          {item.thrustSalesLakh.toFixed(2)} <span>Lac</span>
                        </div>
                        {item.thrustTopProduct && (
                          <div className="team-perf-rm-card-sub">
                            Top: <strong>{item.thrustTopProduct}</strong>
                          </div>
                        )}
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
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => {
                    const status = getTrafficLightStatus(member.achievementPercent);
                    const dotClass =
                      status.light === "🟢" ? "team-perf-dot--green"
                      : status.light === "🟡" ? "team-perf-dot--yellow"
                      : status.light === "🔴" ? "team-perf-dot--red"
                      : "team-perf-dot--grey";
                    const badgeClass =
                      status.light === "🟢" ? "team-perf-badge--green"
                      : status.light === "🟡" ? "team-perf-badge--yellow"
                      : status.light === "🔴" ? "team-perf-badge--red"
                      : "team-perf-badge--grey";

                    return (
                      <tr key={member.id}>
                        <td>
                          <Link
                            href={detailHref(member.id)}
                            onMouseEnter={() => prepareDetail(member.id)}
                            onFocus={() => prepareDetail(member.id)}
                            className="team-perf-name-link"
                          >
                            <span className="team-perf-name-row">
                              <span className={`team-perf-dot ${dotClass}`} aria-hidden="true" />
                              <span className="team-perf-name-text">{member.name}</span>
                              {member.achievementPercent !== null && (
                                <span className={`team-perf-badge ${badgeClass}`} title={status.text}>
                                  {formatPercent(member.achievementPercent)}
                                </span>
                              )}
                              {member.achievementPercent === null && (
                                <span className={`team-perf-badge ${badgeClass}`}>
                                  {status.text}
                                </span>
                              )}
                            </span>
                            <span className="team-perf-name-sub">
                              {member.crmUser?.role === "salesperson" ? "CRM salesperson" : `${member.salespeopleCount} salespeople`}
                              {member.aliases.length > 0 && <> · also spelled {member.aliases.join(", ")}</>}
                            </span>
                          </Link>
                        </td>
                        <td className="numeric">{member.financialDataStatus === "unavailable" ? <><span className="admin-muted">Selected FY data unavailable</span>{member.historicalSales?.slice(0, 2).map(history => <small key={history.financialYear}>{formatFinancialYear(history.financialYear)}: {formatRupees(history.salesValue)} (workbook)</small>)}</> : formatRupees(member.salesValue)}</td>
                        <td className="numeric">
                          {member.thrustSalesLakh && member.thrustSalesLakh > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <span style={{ fontWeight: 800, color: "#166534" }}>
                                {member.thrustSalesLakh.toFixed(2)} L
                              </span>
                              <small style={{ color: "#64748b", fontSize: 10.5 }}>
                                {member.thrustActiveCount == null ? "PDF total" : `${member.thrustActiveCount} product${member.thrustActiveCount !== 1 ? "s" : ""}`}
                              </small>
                            </div>
                          ) : (
                            <span className="admin-muted">—</span>
                          )}
                        </td>
                        <td className="numeric">{member.targetValue > 0 ? <>{formatRupees(member.targetValue)}{!member.reportSource && <small>{formatRupees(member.monthlyTargetValue)} / month ? {data.targetMonths} months</small>}</> : <span className="admin-muted">Not set</span>}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminState>
    </AdminPage>
  );
}
