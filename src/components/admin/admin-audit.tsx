"use client";
import { AdminPage, AdminState } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDateTime, formatNumber } from "@/lib/format";
export function AdminAudit() {
  const audit = useAdminData(() => adminApi.audit(), []);
  const entries = usePagination(audit.data?.items, 25);
  return <AdminPage eyebrow="Security" title="Admin audit log" description="A permanent history of successful administrative changes, including ownership, users, reports and Tally connector actions." actions={<button className="admin-button ghost small" onClick={audit.reload}>Refresh</button>}>
    <AdminState loading={audit.loading} error={audit.error} onRetry={audit.reload} empty={!audit.data?.items.length}>{audit.data && <><p className="admin-result-count">{formatNumber(audit.data.items.length)} recent changes</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Record</th><th>Change details</th><th>Result</th></tr></thead><tbody>{entries.rows.map((item) => <tr key={item.id}><td>{formatDateTime(item.createdAt)}</td><td><strong className="admin-cell-title">{item.userEmail}</strong><small>{item.ipAddress ?? "Local"}</small></td><td><span className="admin-tag">{item.action}</span><small>{item.path}</small></td><td>{item.entityId ?? <span className="admin-muted">—</span>}</td><td><AuditDetails details={item.details} /></td><td><span className="admin-pill positive">{item.statusCode}</span></td></tr>)}</tbody></table></div><Pager pagination={entries} label="changes" /></>}</AdminState>
  </AdminPage>;
}
function AuditDetails({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).filter(([, value]) => value !== undefined);
  if (!entries.length) return <span className="admin-muted">No request details</span>;
  return <span className="audit-details">{entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? `${value.length} selected` : typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}`).join(" · ")}</span>;
}
