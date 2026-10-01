"use client";
import { useState } from "react";
import { AdminPage, AdminState, StatTile } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatNumber, formatPercent, formatRupees } from "@/lib/format";

type AlertView = "checkins" | "followups" | "orders" | "inactive" | "targets";

/** The alert tables on their own, so the field activity page can host them too. */
export function AlertsBody() {
  const [view, setView] = useState<AlertView>("followups");
  const alerts = useAdminData(() => adminApi.alerts(), []);
  const data = alerts.data;

  const checkins = usePagination(data?.missedCheckIns, 25);
  const followups = usePagination(data?.overdueFollowUps, 25);
  const orders = usePagination(data?.overdueOrders, 25);
  const inactive = usePagination(data?.inactiveCustomers, 25);
  const targets = usePagination(data?.targetShortfalls, 25);

  return <>
    <AdminState loading={alerts.loading} error={alerts.error} onRetry={alerts.reload} empty={false}>{data && <>
      <div className="admin-stats alert-stats"><button onClick={() => setView("checkins")}><StatTile label="Missed check-ins" value={formatNumber(data.summary.missedCheckIns)} sub={formatDate(data.asOf)} tone={data.summary.missedCheckIns ? "negative" : "positive"} /></button><button onClick={() => setView("followups")}><StatTile label="Overdue follow-ups" value={formatNumber(data.summary.overdueFollowUps)} sub="Open and past due" tone={data.summary.overdueFollowUps ? "negative" : "positive"} /></button><button onClick={() => setView("orders")}><StatTile label="Overdue expected orders" value={formatNumber(data.summary.overdueOrders)} sub="Commitment date passed" tone={data.summary.overdueOrders ? "negative" : "positive"} /></button><button onClick={() => setView("inactive")}><StatTile label="Inactive customers" value={formatNumber(data.summary.inactiveCustomers)} sub="No invoice for 90 days" tone={data.summary.inactiveCustomers ? "neutral" : "positive"} /></button><button onClick={() => setView("targets")}><StatTile label="Behind target pace" value={formatNumber(data.summary.targetShortfalls)} sub="10% below month pace" tone={data.summary.targetShortfalls ? "negative" : "positive"} /></button></div>
      <div className="admin-tabs">{([['checkins','Missed check-ins'],['followups','Follow-ups'],['orders','Expected orders'],['inactive','Inactive customers'],['targets','Target shortfall']] as Array<[AlertView,string]>).map(([id,label]) => <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div>

      {view === "checkins" && <><AlertTable empty={!data.missedCheckIns.length}><thead><tr><th>Salesperson</th><th>Region</th><th>Territory</th><th>Manager</th><th>Status</th></tr></thead><tbody>{checkins.rows.map((row) => <tr key={row.userId}><td><strong className="admin-cell-title">{row.fullName}</strong><small>{row.email}</small></td><td>{row.region}</td><td>{row.territory}</td><td>{row.managerName ?? "Not assigned"}</td><td><span className="admin-pill negative">Not checked in</span></td></tr>)}</tbody></AlertTable><Pager pagination={checkins} label="salespeople" /></>}

      {view === "followups" && <><AlertTable empty={!data.overdueFollowUps.length}><thead><tr><th>Follow-up</th><th>Customer</th><th>Owner</th><th>Due</th><th className="numeric">Overdue</th></tr></thead><tbody>{followups.rows.map((row) => <tr key={row.id}><td><strong className="admin-cell-title">{row.title}</strong><small>{row.priority}</small></td><td>{row.customer}</td><td>{row.fullName}<small>{row.email}</small></td><td>{formatDate(row.dueDate)}</td><td className="numeric"><span className="admin-pill negative">{row.daysOverdue} days</span></td></tr>)}</tbody></AlertTable><Pager pagination={followups} label="follow-ups" /></>}

      {view === "orders" && <><AlertTable empty={!data.overdueOrders.length}><thead><tr><th>Customer</th><th>Product</th><th>Owner</th><th className="numeric">Expected value</th><th>Expected date</th></tr></thead><tbody>{orders.rows.map((row) => <tr key={row.id}><td><strong className="admin-cell-title">{row.customer}</strong><small>{row.daysOverdue} days overdue</small></td><td>{row.product}</td><td>{row.fullName}</td><td className="numeric">{formatRupees(row.expectedValue)}</td><td>{formatDate(row.expectedDate)}</td></tr>)}</tbody></AlertTable><Pager pagination={orders} label="orders" /></>}

      {view === "inactive" && <><AlertTable empty={!data.inactiveCustomers.length}><thead><tr><th>Customer</th><th>Owner</th><th>Last invoice</th><th className="numeric">Inactive</th><th className="numeric">Outstanding</th></tr></thead><tbody>{inactive.rows.map((row) => <tr key={row.id}><td><strong className="admin-cell-title">{row.name}</strong><small>{row.city}</small></td><td>{row.ownerName}<small>{row.region}</small></td><td>{row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : "Never invoiced"}</td><td className="numeric">{row.inactiveDays === null ? "—" : `${row.inactiveDays} days`}</td><td className="numeric">{formatRupees(row.outstanding)}</td></tr>)}</tbody></AlertTable><Pager pagination={inactive} label="customers" /></>}

      {view === "targets" && <><AlertTable empty={!data.targetShortfalls.length}><thead><tr><th>Salesperson</th><th>Region</th><th className="numeric">Sales</th><th className="numeric">Monthly target</th><th className="numeric">Achieved</th><th className="numeric">Expected pace</th></tr></thead><tbody>{targets.rows.map((row) => <tr key={row.userId}><td><strong className="admin-cell-title">{row.fullName}</strong><small>{row.email}</small></td><td>{row.region}</td><td className="numeric">{formatRupees(row.salesValue)}</td><td className="numeric">{formatRupees(row.targetValue)}</td><td className="numeric"><span className="admin-pill negative">{formatPercent(row.achievedPercent)}</span></td><td className="numeric">{formatPercent(row.expectedPacePercent)}</td></tr>)}</tbody></AlertTable><Pager pagination={targets} label="salespeople" /></>}
    </>}</AdminState>
  </>;
}

export function AdminAlerts() {
  return <AdminPage eyebrow="Accountability" title="Alerts and actions" description="Live exceptions requiring management attention.">
    <AlertsBody />
  </AdminPage>;
}
function AlertTable({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  return empty ? <p className="admin-placeholder">No alerts in this category.</p> : <div className="admin-table-wrap"><table className="admin-table">{children}</table></div>;
}
