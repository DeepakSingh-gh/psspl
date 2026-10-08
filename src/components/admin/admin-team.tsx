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
  const { data, loading, error, reload } = useAdminData(() => adminApi.team(financialYear || undefined), [financialYear]);

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

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Salesperson / RM</th>
                    <th className="numeric">Sales</th>
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
                        <small>{member.followUpsOpen} open follow-ups · {member.checkedInToday ? "Checked in today" : "Not checked in today"}</small>
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
