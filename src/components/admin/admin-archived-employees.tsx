"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatDateTime, formatNumber, formatRupees } from "@/lib/format";
import type { ArchivedEmployee, ArchiveSection } from "@/types/admin";

type Column = { key: string; label: string; kind?: "date" | "time" | "money" };
const sections: Array<{ id: ArchiveSection; label: string; columns: Column[] }> = [
  { id: "visits", label: "Visits", columns: [{ key: "date", label: "Date", kind: "date" }, { key: "customer", label: "Customer" }, { key: "purpose", label: "Purpose" }, { key: "status", label: "Status" }, { key: "outcome", label: "Outcome" }, { key: "notes", label: "Notes" }] },
  { id: "leads", label: "Leads", columns: [{ key: "name", label: "Lead" }, { key: "company", label: "Company" }, { key: "stage", label: "Stage" }, { key: "expectedValue", label: "Expected value", kind: "money" }, { key: "nextActionDate", label: "Next action", kind: "date" }, { key: "notes", label: "Notes" }] },
  { id: "followUps", label: "Follow-ups", columns: [{ key: "dueDate", label: "Due", kind: "date" }, { key: "customer", label: "Customer" }, { key: "title", label: "Follow-up" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }, { key: "notes", label: "Notes" }] },
  { id: "attendance", label: "Attendance", columns: [{ key: "date", label: "Date", kind: "date" }, { key: "checkInAt", label: "Check-in", kind: "time" }, { key: "checkOutAt", label: "Check-out", kind: "time" }, { key: "latitude", label: "Latitude" }, { key: "longitude", label: "Longitude" }] },
  { id: "activities", label: "Activities", columns: [{ key: "occurredAt", label: "Recorded", kind: "time" }, { key: "customer", label: "Customer / lead" }, { key: "type", label: "Type" }, { key: "subject", label: "Subject" }, { key: "notes", label: "Notes" }] },
  { id: "requests", label: "Requests", columns: [{ key: "createdAt", label: "Created", kind: "date" }, { key: "customer", label: "Customer / lead" }, { key: "type", label: "Type" }, { key: "details", label: "Details" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due", kind: "date" }] },
  { id: "customers", label: "Customers", columns: [{ key: "name", label: "Customer" }, { key: "city", label: "City" }, { key: "outstanding", label: "Outstanding", kind: "money" }] },
  { id: "orders", label: "Expected orders", columns: [{ key: "customer", label: "Customer" }, { key: "product", label: "Product" }, { key: "expectedValue", label: "Expected value", kind: "money" }, { key: "expectedDate", label: "Expected date", kind: "date" }, { key: "status", label: "Status" }] },
  { id: "reports", label: "Saved reports", columns: [{ key: "type", label: "Report type" }, { key: "dateFrom", label: "From", kind: "date" }, { key: "dateTo", label: "To", kind: "date" }, { key: "createdAt", label: "Created", kind: "time" }] },
];
const roleLabel = (role: string) => role === "rm" ? "Regional manager" : role === "admin" ? "Administrator" : "Salesperson";
const nameOf = (employee: ArchivedEmployee) => employee.fullName || employee.employeeCode || "Archived employee";

function History({ employee, onRestore }: { employee: ArchivedEmployee; onRestore: () => void }) {
  const [section, setSection] = useState<ArchiveSection>("visits");
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData(() => adminApi.archivedUserHistory(employee.id, section, page), [employee.id, section, page], `archive-${employee.id}-${section}-${page}`);
  const selected = sections.find(item => item.id === section)!;
  const counts = data?.employee.counts ?? employee.counts;
  function cell(value: string | number | null | undefined, column: Column) {
    if (value === null || value === undefined || value === "") return "—";
    if (column.kind === "money") return formatRupees(Number(value));
    if (column.kind === "date") return formatDate(String(value));
    if (column.kind === "time") return formatDateTime(String(value));
    return String(value);
  }
  return <section className="archive-detail" aria-label={`History for ${nameOf(employee)}`}>
    <header className="archive-detail-header"><div><span className="archive-eyebrow">Preserved employee history</span><h2>{nameOf(employee)}</h2><p>{roleLabel(employee.role)}{employee.employeeCode ? ` · ${employee.employeeCode}` : ""}</p><p>{[employee.region, employee.territory].filter(Boolean).join(" · ")}</p>{employee.managerName && <p>Reported to: <strong>{employee.managerName}</strong></p>}</div><div className="archive-detail-actions"><span className="archive-badge">Archived {formatDate(employee.deletedAt)}</span><button type="button" className="admin-button" onClick={onRestore}>Restore employee</button></div></header>
    <p className="archive-note">Read-only records. Sign-in credentials were removed when this account was deleted. Use Restore employee to set new sign-in credentials and restore access. Customer ownership shown here reflects the current saved ownership.</p>
    <div className="archive-sections" role="group" aria-label="History sections">{sections.map(item => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => { setSection(item.id); setPage(1); }}>{item.label}<span>{formatNumber(counts[item.id])}</span></button>)}</div>
    <AdminState loading={loading} error={error} onRetry={reload}>
      {data && <><div className="archive-section-title"><h3>{selected.label}</h3><span>{formatNumber(data.total)} records</span></div>
        {data.items.length ? <><div className="admin-table-wrap archive-history-table"><table className="admin-table"><thead><tr>{selected.columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{data.items.map(row => <tr key={String(row.id)}>{selected.columns.map(column => <td key={column.key}>{cell(row[column.key], column)}</td>)}</tr>)}</tbody></table></div>
          {data.pages > 1 && <div className="admin-pager"><span className="admin-pager-range">Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}</span><button type="button" className="admin-button ghost small" disabled={data.page === 1 || loading} onClick={() => setPage(data.page - 1)}>Previous</button><span className="admin-pager-count">Page {data.page} of {data.pages}</span><button type="button" className="admin-button ghost small" disabled={data.page === data.pages || loading} onClick={() => setPage(data.page + 1)}>Next</button></div>}
        </> : <p className="admin-placeholder">No {selected.label.toLowerCase()} were recorded for this employee.</p>}
      </>}
    </AdminState>
  </section>;
}

export function AdminArchivedEmployees() {
  const { data, loading, error, reload, setData } = useAdminData(() => adminApi.archivedUsers(), [], "admin-archived-employees");
  const [restoring, setRestoring] = useState<ArchivedEmployee | null>(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const employees = data?.items ?? [];
  const query = search.trim().toLocaleLowerCase();
  const matches = employees.filter(employee => (role === "all" || employee.role === role) && (!query || [employee.fullName, employee.employeeCode, employee.managerName, employee.region, employee.territory].some(value => value?.toLocaleLowerCase().includes(query))));
  const selected = matches.find(employee => employee.id === selectedId) ?? matches[0];
  return <AdminPage eyebrow="Employee archive" title="Archived employees" description="View preserved CRM records for deleted employee accounts. Select a person to review their history."
    actions={<Link className="admin-button ghost" href="/admin/users">Users &amp; access</Link>}>
    {notice && <p className="admin-note success" role="status">{notice}</p>}
    <AdminState loading={loading} error={error} onRetry={reload}>
      {data && <><div className="archive-summary"><div><span>Archived accounts</span><strong>{employees.length}</strong></div><div><span>Salespeople</span><strong>{employees.filter(employee => employee.role === "salesperson").length}</strong></div><div><span>Regional managers</span><strong>{employees.filter(employee => employee.role === "rm").length}</strong></div></div>
        {!employees.length ? <p className="admin-placeholder">No archived employees yet. Deleted accounts will appear here with their preserved history.</p> : <>
          <div className="archive-filters"><label className="admin-search"><span>Search archived employees</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, employee code, RM or region" /></label><label className="admin-select"><span>Archived role</span><select value={role} onChange={event => setRole(event.target.value)}><option value="all">All roles</option><option value="salesperson">Salespeople</option><option value="rm">Regional managers</option><option value="admin">Administrators</option></select></label></div>
          {selected ? <div className="archive-layout"><aside className="archive-directory" aria-label="Archived employee list"><p>{matches.length} of {employees.length} archived accounts</p><ul>{matches.map(employee => <li key={employee.id}><button type="button" aria-pressed={employee.id === selected.id} onClick={() => setSelectedId(employee.id)}><strong>{nameOf(employee)}</strong><span>{roleLabel(employee.role)}{employee.employeeCode ? ` · ${employee.employeeCode}` : ""}</span><small>Archived {formatDate(employee.deletedAt)}</small></button></li>)}</ul></aside><History key={selected.id} employee={selected} onRestore={() => { setNotice(""); setRestoring(selected); }} /></div>
            : <div className="admin-placeholder" role="status">No archived employees match your filters.<button type="button" className="admin-button ghost small" onClick={() => { setSearch(""); setRole("all"); }}>Clear filters</button></div>}
        </>}
      </>}
    </AdminState>
    {restoring && <RestoreEmployeeDialog employee={restoring} onClose={() => setRestoring(null)} onRestored={() => {
      setNotice(`${nameOf(restoring)} has been restored and can sign in with the new credentials. View the account in Users & access.`);
      setData({ items: employees.filter(employee => employee.id !== restoring.id) });
      setRestoring(null);
      reload();
    }} />}
  </AdminPage>;
}


function RestoreEmployeeDialog({ employee, onClose, onRestored }: { employee: ArchivedEmployee; onClose: () => void; onRestored: () => void }) {
  const { data, loading, error: loadError, reload } = useAdminData(() => adminApi.users(), [], "archive-restore-managers");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const managers = data?.managers ?? [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const initialPassword = String(form.get("initialPassword") || "");
    setError("");
    if (initialPassword !== String(form.get("confirmPassword") || "")) { setError("The passwords do not match"); return; }
    setSaving(true);
    try {
      await adminApi.restoreArchivedUser(employee.id, {
        email: String(form.get("email") || "").trim(),
        loginId: String(form.get("loginId") || "").trim(),
        initialPassword,
        managerUserId: employee.role === "salesperson" ? String(form.get("managerUserId") || "") : null,
      });
      onRestored();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to restore this employee"); }
    finally { setSaving(false); }
  }
  return <div className="admin-drawer" role="dialog" aria-modal="true" aria-label="Restore employee">
    <button type="button" className="admin-drawer-scrim" onClick={onClose} disabled={saving} aria-label="Close" />
    <div className="admin-drawer-panel">
      <header><div><p className="admin-eyebrow">Employee archive</p><h2>Restore {nameOf(employee)}</h2></div><button type="button" className="admin-button ghost small" onClick={onClose} disabled={saving}>Close</button></header>
      <p className="admin-note subtle">Restore this {roleLabel(employee.role).toLowerCase()} with their existing employee code and CRM history. Enter new sign-in credentials because the previous credentials were removed. The account can sign in immediately. Share the password privately; no email will be sent.</p>
      <form className="admin-form" onSubmit={submit}>
        <fieldset className="archive-restore-fields" disabled={saving}>
          <label className="admin-field"><span className="admin-field-label">Login ID</span><input name="loginId" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*" autoComplete="off" /><small className="admin-field-hint">3 to 64 letters, numbers, dots, underscores or hyphens.</small></label>
          <label className="admin-field"><span className="admin-field-label">Work email</span><input name="email" type="email" required autoComplete="off" /></label>
          {employee.role === "salesperson" && <AdminState loading={loading} error={loadError} onRetry={reload}>
            <label className="admin-field"><span className="admin-field-label">Reports to RM</span><select name="managerUserId" required defaultValue={managers.some(manager => manager.id === employee.managerUserId) ? employee.managerUserId! : ""}><option value="">Select an active RM</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.fullName} ? {manager.email}</option>)}</select></label>
            {data && !managers.length && <p className="admin-note subtle">Add or restore an active regional manager before restoring this salesperson.</p>}
          </AdminState>}
          <label className="admin-field"><span className="admin-field-label">New password</span><input name="initialPassword" type={showPassword ? "text" : "password"} required minLength={12} maxLength={200} autoComplete="new-password" /><small className="admin-field-hint">At least 12 characters.</small></label>
          <label className="admin-field"><span className="admin-field-label">Confirm new password</span><input name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={12} maxLength={200} autoComplete="new-password" /></label>
          <button type="button" className="admin-button ghost small" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? "Hide passwords" : "Show passwords"}</button>
        </fieldset>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-dialog-actions"><button type="button" className="admin-button ghost" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="admin-button" disabled={saving || (employee.role === "salesperson" && (loading || Boolean(loadError) || !managers.length))}>{saving ? "Restoring..." : "Restore employee"}</button></div>
      </form>
    </div>
  </div>;
}
