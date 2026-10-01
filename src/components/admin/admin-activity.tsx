"use client";
import { useState } from "react";
import { AdminPage, AdminState, StatTile } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { AlertsBody } from "./admin-alerts";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { MovementResponse } from "@/types/admin";

type Tab = "visits" | "followUps" | "attendance";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "visits", label: "Visits" },
  { id: "followUps", label: "Follow-ups" },
  { id: "attendance", label: "Attendance" },
];

type Section = "activity" | "alerts";

export function AdminActivity({ initialSection = "activity" }: { initialSection?: Section } = {}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [tab, setTab] = useState<Tab>("visits");
  const [movement, setMovement] = useState<MovementResponse | null>(null);
  const [movementError, setMovementError] = useState("");
  const [movementLoading, setMovementLoading] = useState(false);
  const { data, loading, error, reload } = useAdminData(() => adminApi.activity(), []);
  const visits = usePagination(data?.visits, 25);
  const followUps = usePagination(data?.followUps, 25);
  const attendance = usePagination(data?.attendance, 25);

  const openFollowUps = data?.followUps.filter((item) => !item.completed).length ?? 0;
  const visitsToday = data?.visits.filter((item) => item.businessDate === data.today).length ?? 0;

  async function showMovement(userId: string, date: string) {
    setMovementLoading(true); setMovementError("");
    try { setMovement(await adminApi.movement(userId, date)); }
    catch (cause) { setMovementError(cause instanceof Error ? cause.message : "Unable to load movement"); }
    finally { setMovementLoading(false); }
  }

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

            {tab === "attendance" && (
              data.attendance.length === 0
                ? <p className="admin-placeholder">No check-ins have been recorded yet.</p>
                : (
                  <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th>Date</th><th>Salesperson</th><th>Checked in</th><th>Checked out</th><th>Starting location</th><th>Route tracking</th><th></th></tr></thead>
                      <tbody>
                        {attendance.rows.map((row) => (
                          <tr key={row.id}>
                            <td>{formatDate(row.businessDate)}</td>
                            <td><strong className="admin-cell-title">{row.fullName ?? row.email}</strong><small>{row.email}</small></td>
                            <td>{formatDateTime(row.checkInAt)}</td>
                            <td>{row.checkOutAt ? formatDateTime(row.checkOutAt) : <span className="admin-muted">—</span>}</td>
                            <td>{row.latitude !== null && row.longitude !== null ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}` : <span className="admin-muted">Not captured</span>}</td>
                            <td><strong className="admin-cell-title">{formatNumber(row.movementPoints)} points</strong><small>{row.lastLocationAt ? `Latest ${formatDateTime(row.lastLocationAt)}` : "No movement received"}</small></td>
                            <td><button type="button" className="admin-button ghost small" disabled={movementLoading} onClick={() => showMovement(row.userId, row.businessDate)}>View route</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager pagination={attendance} label="check-ins" />
                  </>
                )
            )}
            {tab === "attendance" && movementError && <div className="admin-error">{movementError}</div>}
            {tab === "attendance" && movement && <MovementPanel data={movement} onClose={() => setMovement(null)} />}
          </>
        )}
      </AdminState>}
    </AdminPage>
  );
}

function MovementPanel({ data, onClose }: { data: MovementResponse; onClose: () => void }) {
  const width = 760, height = 260, pad = 26;
  const latitudes = data.points.map((point) => point.latitude), longitudes = data.points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes), minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
  const points = data.points.map((point) => {
    const x = pad + ((point.longitude - minLng) / (maxLng - minLng || 1)) * (width - pad * 2);
    const y = height - pad - ((point.latitude - minLat) / (maxLat - minLat || 1)) * (height - pad * 2);
    return { ...point, x, y };
  });
  const latest = data.points[data.points.length - 1];
  return <section className="admin-card movement-panel">
    <header className="admin-card-header"><div><p className="admin-eyebrow">Full-day movement</p><h2>{data.attendance.fullName ?? data.attendance.email} · {formatDate(data.date)}</h2></div><button type="button" className="admin-button ghost small" onClick={onClose}>Close</button></header>
    <div className="movement-summary"><span>Check-in<strong>{formatDateTime(data.attendance.checkInAt)}</strong></span><span>Check-out<strong>{data.attendance.checkOutAt ? formatDateTime(data.attendance.checkOutAt) : "Tracking active"}</strong></span><span>Location points<strong>{formatNumber(data.points.length)}</strong></span><span>Approx. movement<strong>{formatNumber(data.distanceKm, 2)} km</strong></span></div>
    {points.length > 0 ? <>
      <div className="movement-map" aria-label="Recorded route map"><svg viewBox={`0 0 ${width} ${height}`} role="img"><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />{points.map((point, index) => <circle key={`${point.capturedAt}-${index}`} cx={point.x} cy={point.y} r={index === 0 || index === points.length - 1 ? 7 : 3} className={index === 0 ? "start" : index === points.length - 1 ? "finish" : ""} />)}</svg><div className="movement-legend"><span><i className="start" /> Start</span><span><i className="finish" /> Latest</span></div></div>
      {latest && <a className="admin-link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${latest.latitude}&mlon=${latest.longitude}#map=16/${latest.latitude}/${latest.longitude}`}>Open latest location on map</a>}
      <div className="movement-timeline">{data.points.map((point, index) => <div key={`${point.capturedAt}-${index}`}><span>{index + 1}</span><p><strong>{formatDateTime(point.capturedAt)}</strong><small>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}{point.accuracy ? ` · accuracy ${Math.round(point.accuracy)} m` : ""}</small></p></div>)}</div>
    </> : <p className="admin-placeholder">No movement locations were captured for this day.</p>}
  </section>;
}
