"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { buildReportingStructure } from "@/lib/reporting-structure";
import { initialsOf } from "@/lib/format";
import type { AdminUser } from "@/types/admin";

const displayName = (user: AdminUser) => user.fullName || user.email;
const matches = (user: AdminUser, query: string) => [user.fullName, user.email, user.loginId, user.employeeCode, user.region, user.territory].some(value => value?.toLocaleLowerCase().includes(query));

function AccountStatus({ user }: { user: AdminUser }) {
  return <span className={`org-status ${user.active ? "org-status-active" : "org-status-inactive"}`}>{user.active ? "Active" : user.invitationPending ? "Invitation pending" : "Inactive"}</span>;
}

function SalespersonList({ members }: { members: AdminUser[] }) {
  return <ul className="org-people">
    {members.map(person => <li key={person.id} data-person-id={person.id}>
      <span className="org-person-mark" aria-hidden="true">{initialsOf(displayName(person))}</span>
      <div className="org-person-info"><strong>{displayName(person)}</strong><span>{person.employeeCode || "Salesperson"}</span><span className="org-email">{person.email}</span></div>
      <AccountStatus user={person} />
    </li>)}
  </ul>;
}

export function AdminTeamStructure() {
  const { data, loading, error, reload } = useAdminData(() => adminApi.users(), [], "admin-reporting-structure");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const structure = useMemo(() => buildReportingStructure(data?.items ?? []), [data?.items]);
  const query = search.trim().toLocaleLowerCase();
  const groups = structure.groups.map(group => ({ ...group, visibleMembers: !query || matches(group.manager, query) ? group.members : group.members.filter(person => matches(person, query)) }))
    .filter(group => !query || matches(group.manager, query) || group.visibleMembers.length > 0);
  const unassigned = query ? structure.unassigned.filter(person => matches(person, query)) : structure.unassigned;
  const toggle = (id: string) => setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return <AdminPage eyebrow="People & reporting" title="Team structure" description="See every RM and the salespeople assigned to them across the CRM. Reporting lines follow the assignments saved in Users & access."
    actions={<Link className="admin-button" href="/admin/users">Manage accounts</Link>}>
    <AdminState loading={loading} error={error} onRetry={reload} empty={!data?.items.length}>
      {data && <div className="org-structure">
        <section className="org-root" aria-label="Admin oversight">
          <div className="org-root-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7Z" /><path d="m8 12 3 3 5-6" /></svg></div>
          <div className="org-root-copy"><span className="org-eyebrow">Admin oversight</span><h2>Admin → RMs → Salespeople</h2><p>{structure.totals.admins} administrator{structure.totals.admins === 1 ? "" : "s"} · {structure.totals.rms} RM{structure.totals.rms === 1 ? "" : "s"} · {structure.totals.salespeople} salespeople</p></div>
          <ul className="org-admins" aria-label="Administrator accounts">{structure.admins.map(admin => <li key={admin.id}><strong>{displayName(admin)}</strong><span className="org-email">{admin.email}</span><AccountStatus user={admin} /></li>)}</ul>
        </section>

        <div className="org-stats" aria-label="Reporting totals">
          <div><span>Regional managers</span><strong data-testid="org-rm-total">{structure.totals.rms}</strong><small>{structure.totals.activeRms} active · {structure.totals.rms - structure.totals.activeRms} inactive</small></div>
          <div><span>Salespeople</span><strong data-testid="org-salesperson-total">{structure.totals.salespeople}</strong><small>{structure.totals.assigned} assigned to an RM · {structure.totals.activeSalespeople} active</small></div>
          <div className={structure.totals.unassigned ? "org-stat-warning" : undefined}><span>Need an RM assignment</span><strong data-testid="org-unassigned-total">{structure.totals.unassigned}</strong><small>{structure.totals.unassigned ? "Review these reporting lines" : "Every salesperson has an RM"}</small></div>
        </div>

        <div className="org-toolbar">
          <label className="admin-search"><span>Search reporting structure</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setCollapsed(new Set()); }} placeholder="RM or salesperson name, email, code…" /></label>
          <div className="org-toolbar-actions"><button className="admin-button ghost small" onClick={() => setCollapsed(new Set())}>Expand all</button><button className="admin-button ghost small" onClick={() => setCollapsed(new Set([...structure.groups.map(group => group.manager.id), "unassigned"]))}>Collapse all</button></div>
        </div>
        <p className="org-explainer">All accounts are included; inactive and pending accounts are marked. Each salesperson appears under their saved RM account. Administrator oversight is shared across the CRM.</p>
        {query && <p className="org-search-result" role="status">Showing {groups.length} of {structure.totals.rms} RMs and {groups.reduce((sum, group) => sum + group.visibleMembers.length, 0) + unassigned.length} matching salespeople. Totals above show the full structure.</p>}

        <div className="org-teams" aria-label="RM reporting teams">
          {groups.map(({ manager, members, visibleMembers }) => {
            const expanded = !collapsed.has(manager.id);
            const activeCount = members.filter(person => person.active).length;
            const panelId = `org-team-${manager.id}`;
            return <section key={manager.id} className="org-team" data-manager-id={manager.id} aria-label={`RM ${displayName(manager)}`}>
              <div className="org-team-header">
                <div className="org-manager-line"><span className="org-manager-mark" aria-hidden="true">{initialsOf(displayName(manager))}</span><div className="org-manager-info"><span className="org-eyebrow">Regional manager</span><h2><button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(manager.id)}>{displayName(manager)}<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg></button></h2><span className="org-email">{manager.email}</span></div><AccountStatus user={manager} /></div>
                <p className="org-manager-territory">{[manager.employeeCode, manager.region, manager.territory].filter(Boolean).join(" · ") || "Region not set"}</p>
                <div className="org-team-count"><strong>{members.length} {members.length === 1 ? "salesperson" : "salespeople"}</strong><span>{activeCount} active · {members.length - activeCount} inactive</span></div>
              </div>
              <div id={panelId} hidden={!expanded} className="org-team-body">
                {visibleMembers.length ? <><SalespersonList members={visibleMembers} />{visibleMembers.length !== members.length && <p className="org-empty">{visibleMembers.length} of {members.length} team members match your search.</p>}</> : <p className="org-empty">No salespeople assigned to this RM.</p>}
              </div>
            </section>;
          })}
        </div>
        {!structure.groups.length && !query && <div className="admin-placeholder">No RM accounts have been created yet. <Link href="/admin/users">Add an RM in Users &amp; access.</Link></div>}
        {unassigned.length > 0 && <section className="org-unassigned" aria-label="Salespeople needing an RM">
          <h2><button type="button" aria-expanded={!collapsed.has("unassigned")} aria-controls="org-unassigned-people" onClick={() => toggle("unassigned")}>Needs an RM assignment <span>{unassigned.length}</span></button></h2>
          <p>These salespeople have no saved RM, or their manager is no longer an RM account. Assign them in Users &amp; access.</p>
          <div id="org-unassigned-people" hidden={collapsed.has("unassigned")}><SalespersonList members={unassigned} /></div>
        </section>}
        {query && !groups.length && !unassigned.length && <div className="admin-placeholder" role="status">No RM or salesperson matches this search.<button type="button" className="admin-button ghost small" onClick={() => setSearch("")}>Clear search</button></div>}
      </div>}
    </AdminState>
  </AdminPage>;
}
