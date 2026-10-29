"use client";
import { useState } from "react";
import { AdminPage, AdminState, StatTile } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { AlertsBody } from "./admin-alerts";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatNumber } from "@/lib/format";

type Tab = "visits" | "followUps";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "visits", label: "Visits" },
  { id: "followUps", label: "Follow-ups" },
];

type Section = "activity" | "alerts";

export function AdminActivity({ initialSection = "activity" }: { initialSection?: Section } = {}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [tab, setTab] = useState<Tab>("visits");
  const { data, loading, error, reload } = useAdminData(() => adminApi.activity(), [], "admin-activity", true);
  const visits = usePagination(data?.visits, 25);
  const followUps = usePagination(data?.followUps, 25);

  const openFollowUps = data?.followUps.filter((item) => !item.completed).length ?? 0;
  const visitsToday = data?.visits.filter((item) => item.businessDate === data.today).length ?? 0;


  return (
    <AdminPage
      eyebrow="Field operations"
      title="Field activity and alerts"
      description="What salespeople recorded in the CRM, and the exceptions that need management attention."
      actions={<button type="button" className="admin-button ghost small" onClick={reload}>Refresh</button>}
    >
      <div className="section-switch" role="tablist" aria-label="Field operations view">
        <button type="button" role="tab" aria-selected={section === "activity"} className={section === "activity" ? "is-on" : ""} onClick={() => setSection("activity")}>Activity</button>
        <button type="button" role="tab" aria-selected={section === "alerts"} className={section === "alerts" ? "is-on" : ""} onClick={() => setSection("alerts")}>Alerts</button>
      </div>

      {section === "alerts" && <AlertsBody />}

      {section === "activity" && <AdminState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="admin-stats">
              <StatTile label="Visits today" value={formatNumber(visitsToday)} sub={formatDate(data.today)} />
              <StatTile label="Visits recorded" value={formatNumber(data.visits.length)} sub="Most recent 100" />
              <StatTile label="Follow-ups open" value={formatNumber(openFollowUps)} sub={`${formatNumber(data.followUps.length)} total`} />
              <StatTile label="Check-ins" value={formatNumber(data.attendance.length)} sub="Most recent 60 days" />
            </div>

            <div className="admin-tabs" role="tablist">
              {TABS.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : undefined} onClick={() => setTab(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "visits" && (
              data.visits.length === 0
                ? <p className="admin-placeholder">No visits have been recorded yet.</p>
                : (
                  <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Date</th><th>Salesperson</th><th>Customer</th><th>Purpose</th><th>Status</th><th>Outcome</th></tr></thead>
                      <tbody>
                        {visits.rows.map((visit) => (
                          <tr key={visit.id}>
                            <td>{formatDate(visit.businessDate)}</td>
                            <td><strong className="admin-cell-title">{visit.fullName ?? visit.email}</strong><small>{visit.email}</small></td>
                            <td>{visit.customer}</td>
                            <td>{visit.purpose}</td>
                            <td><span className={`admin-pill ${visit.status === "completed" ? "positive" : visit.status === "in_progress" ? "neutral" : ""}`}>{visit.status.replace("_", " ")}</span></td>
                            <td>{visit.outcome ?? <span className="admin-muted">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager pagination={visits} label="visits" />
                  </>
                )
            )}

            {tab === "followUps" && (
              data.followUps.length === 0
                ? <p className="admin-placeholder">No follow-ups have been created yet.</p>
                : (
                  <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Follow-up</th><th>Customer</th><th>Owner</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead>
                      <tbody>
                        {followUps.rows.map((item) => (
                          <tr key={item.id}>
                            <td><strong className="admin-cell-title">{item.title}</strong></td>
                            <td>{item.customer}</td>
                            <td>{item.fullName ?? item.email}</td>
                            <td>{formatDate(item.dueDate)}</td>
                            <td><span className="admin-tag">{item.priority}</span></td>
                            <td><span className={`admin-pill ${item.completed ? "positive" : "neutral"}`}>{item.completed ? "Done" : "Open"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager pagination={followUps} label="follow-ups" />
                  </>
                )
            )}

          </>
        )}
      </AdminState>}
    </AdminPage>
  );
}

