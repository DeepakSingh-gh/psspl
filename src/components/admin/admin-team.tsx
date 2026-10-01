"use client";
import { useState } from "react";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatFinancialYear, formatNumber, formatPercent, formatRupees } from "@/lib/format";

export function AdminTeam() {
  const [financialYear, setFinancialYear] = useState<string>("");
  const { data, loading, error, reload } = useAdminData(() => adminApi.team(financialYear || undefined), [financialYear]);

  return (
    <AdminPage
      eyebrow="Team performance"
      title="Sales team performance"
      description="Live Tally sales are matched to each salesperson or regional manager through the customer owner saved in the CRM."
      actions={
        data && data.financialYears.length > 0 ? (
          <label className="admin-select">
            <span>Financial year</span>
            <select value={financialYear || data.financialYear || ""} onChange={(event) => setFinancialYear(event.target.value)}>
              {data.financialYears.map((year) => <option key={year} value={year}>{formatFinancialYear(year)}</option>)}
            </select>
          </label>
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
                  {data.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
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
