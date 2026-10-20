"use client";
import { useEffect, useState } from "react";
import { rmApi } from "@/lib/api";

export function RmAlerts() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    rmApi.alerts()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const badge = (n: number) => n > 0 ? <span style={{ background: "#ef4444", color: "#fff", borderRadius: "9999px", padding: "0 6px", fontSize: "0.75rem", marginLeft: "0.5rem" }}>{n}</span> : null;

  return (
    <div className="admin-content">
      <section className="admin-page">
        <header className="admin-page-header">
          <div className="admin-page-heading">
            <p className="admin-eyebrow">Regional Manager</p>
            <h1>Team Alerts</h1>
            <p className="admin-page-description">Overdue follow-ups, missed check-ins, and open orders for your team.</p>
          </div>
        </header>
        {error && <div className="admin-error">{error}</div>}
        {loading ? <div className="admin-placeholder">Loading alerts…</div> : data && (
          <>
            {data.reminders && <section className="admin-panel"><p>In-app: {data.reminders.followUps.pending} pending follow-ups ({data.reminders.followUps.dueToday} due today); {data.reminders.visits.upcoming} upcoming visits; {data.reminders.visits.pastScheduled} past scheduled visits needing confirmation.</p>{data.reminders.managementAttention.map((item: any) => <p key={`${item.rmName}:${item.id}`}><strong>{item.title}</strong> ? {item.metric}. {item.action} {item.thresholdsProvisional ? "Provisional threshold." : ""}</p>)}</section>}
            {/* Missed Check-ins */}
            <div className="admin-section-title" style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
              Missed Check-ins Today {badge(data.missedCheckIns?.length ?? 0)}
            </div>
            {data.missedCheckIns?.length === 0
              ? <p className="admin-muted" style={{ marginBottom: "1.5rem" }}>Everyone checked in today ✓</p>
              : <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
                  <table className="admin-table">
                    <thead><tr><th>Salesperson</th><th>Territory</th><th>Region</th></tr></thead>
                    <tbody>
                      {data.missedCheckIns.map((m: any) => (
                        <tr key={m.id}><td><strong>{m.fullName}</strong><small>{m.email}</small></td><td>{m.territory}</td><td>{m.region}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }

            {/* Overdue Follow-ups */}
            <div className="admin-section-title" style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
              Overdue Follow-ups {badge(data.overdueFollowUps?.length ?? 0)}
            </div>
            {data.overdueFollowUps?.length === 0
              ? <p className="admin-muted" style={{ marginBottom: "1.5rem" }}>No overdue follow-ups ✓</p>
              : <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
                  <table className="admin-table">
                    <thead><tr><th>Salesperson</th><th>Customer</th><th>Follow-up</th><th>Due date</th><th>Days overdue</th></tr></thead>
                    <tbody>
                      {data.overdueFollowUps.map((f: any) => (
                        <tr key={f.id}>
                          <td>{f.fullName}<small>{f.email}</small></td>
                          <td>{f.customer ?? "—"}</td>
                          <td>{f.title}</td>
                          <td>{f.dueDate}</td>
                          <td><span className="admin-pill" style={{ background: "#fef2f2", color: "#dc2626" }}>{f.daysOverdue}d</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }

            {/* Overdue Expected Orders */}
            <div className="admin-section-title" style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
              Overdue Expected Orders {badge(data.overdueOrders?.length ?? 0)}
            </div>
            {data.overdueOrders?.length === 0
              ? <p className="admin-muted" style={{ marginBottom: "1.5rem" }}>No overdue orders ✓</p>
              : <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
                  <table className="admin-table">
                    <thead><tr><th>Salesperson</th><th>Customer</th><th>Product</th><th className="numeric">Value</th><th>Expected</th><th>Days overdue</th></tr></thead>
                    <tbody>
                      {data.overdueOrders.map((o: any) => (
                        <tr key={o.id}>
                          <td>{o.fullName}</td>
                          <td>{o.customer ?? "—"}</td>
                          <td>{o.product ?? "—"}</td>
                          <td className="numeric">₹{((o.expectedValue ?? 0) / 100000).toFixed(2)}L</td>
                          <td>{o.expectedDate}</td>
                          <td><span className="admin-pill" style={{ background: "#fef2f2", color: "#dc2626" }}>{o.daysOverdue}d</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </>
        )}
      </section>
    </div>
  );
}
