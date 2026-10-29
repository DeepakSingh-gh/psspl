"use client";
import { reportDateRange } from "@/lib/business-date";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, clearSession, rmApi } from "@/lib/api";
import { formatDateTime, formatNumber, formatRupees } from "@/lib/format";
import { PssplLogo } from "@/components/common/psspl-logo";

interface Member {
  id: string; email: string; active: number; fullName: string; region: string; territory: string;
  monthlyTarget: number; salesValue: number; invoiceCount: number; customerCount: number; outstanding: number;
  visitsTotal: number; visitsCompleted: number; followUpsOpen: number; isSelf?: number;
  attendance: { checkInAt: string; checkOutAt: string | null } | null;
}

interface RmData {
  manager: { email: string; fullName: string; region: string; territory: string };
  from: string; to: string;
  summary: { salesValue: number; customers: number; outstanding: number; visitsCompleted: number; visitsTotal: number; followUpsOpen: number };
  members: Member[];
  pipeline: Array<{ stage: string; count: number; expectedValue: number }>;
}

const ICONS: Record<string, React.ReactNode> = {
  home: <><path d="M2.6 7.2 8 3l5.4 4.2V13a1 1 0 0 1-1 1H10v-3.4H6V14H3.6a1 1 0 0 1-1-1Z" /></>,
  team: <><circle cx="6" cy="5" r="2.2" /><path d="M2 13c0-2.2 1.8-3.5 4-3.5S10 10.8 10 13" /><circle cx="12" cy="5.6" r="1.6" /><path d="M11 9.8c1.7 0 3 1 3 3.2" /></>,
  day: <><path d="M8 14s4.6-4 4.6-7.4A4.6 4.6 0 0 0 8 2a4.6 4.6 0 0 0-4.6 4.6C3.4 10 8 14 8 14Z" /><circle cx="8" cy="6.4" r="1.7" /></>,
};

const NavIcon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

export function RmDashboard() {
  const router = useRouter();
  const defaults = useMemo(() => reportDateRange("fy"), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [range, setRange] = useState(defaults);
  const [data, setData] = useState<RmData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(({ user }) => { if (user.role !== "rm") router.replace(user.role === "admin" ? "/admin" : "/sales/my-day"); })
      .catch(() => { clearSession(); router.replace("/login"); });
  }, [router]);

  useEffect(() => {
    setLoading(true);
    rmApi.dashboard(range.from, range.to)
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load team"))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const request = event as CustomEvent<{ tasks: Promise<unknown>[] }>;
      const task = rmApi.dashboard(range.from, range.to)
        .then((fresh) => { setData(fresh); setError(""); })
        .catch((cause) => { setError(cause instanceof Error ? cause.message : "Unable to refresh team"); throw cause; });
      request.detail.tasks.push(task);
    };
    window.addEventListener("psspl:refresh-data", refresh);
    return () => window.removeEventListener("psspl:refresh-data", refresh);
  }, [range]);

  async function signOut() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  const team = data?.members.filter((member) => !member.isSelf) ?? [];
  const soloBook = Boolean(data && team.length === 0);

  return (
    <div className="admin-shell rm-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <PssplLogo />
        </div>
        <p className="admin-workspace">Regional manager workspace</p>
        <nav>
          <div className="admin-nav-group">
            <a href="/rm"><NavIcon name="home" />Home</a>
            <a className="active" href="/rm/team"><NavIcon name="team" />My team</a>
            <a href="/rm/report-card"><NavIcon name="team" />Report Card</a>
            <a href="/rm/customers"><NavIcon name="day" />Customers</a>
            <a href="/rm/products"><NavIcon name="home" />Product Trends</a>
            <a href="/rm/alerts"><NavIcon name="team" />Alerts</a>
            <a href="/sales/my-day"><NavIcon name="day" />My Day</a>
          </div>
        </nav>
        <div className="admin-user">
          <span aria-hidden="true">{data?.manager.fullName?.slice(0, 1) ?? "R"}</span>
          <span className="admin-user-name">
            <strong>{data?.manager.fullName ?? "Regional manager"}</strong>
            <small>{data?.manager.region}</small>
          </span>
          <a href="/profile">Profile</a>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-content">
          <section className="admin-page">
            <header className="admin-page-header">
              <div className="admin-page-heading">
                <p className="admin-eyebrow">Regional manager</p>
                <h1>My team performance</h1>
                <p className="admin-page-description">Your own customer book plus any salespeople assigned to you.</p>
              </div>
              <form className="rm-range" onSubmit={(event) => { event.preventDefault(); setRange({ from, to }); }}>
                <label><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                <label><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                <button className="admin-button" type="submit">Apply</button>
              </form>
            </header>

            {error && <div className="admin-error">{error}</div>}

            {loading && !data ? <div className="admin-placeholder">Loading your team…</div> : data && (
              <>
                <div className="admin-stats">
                  <article className="admin-stat">
                    <span className="admin-stat-label">Sales</span>
                    <strong>{formatRupees(data.summary.salesValue)}</strong>
                    <small>{data.from} to {data.to}</small>
                  </article>
                  <article className="admin-stat">
                    <span className="admin-stat-label">Customers</span>
                    <strong>{formatNumber(data.summary.customers)}</strong>
                    <small>{soloBook ? "On your own book" : `Across ${data.members.length} people`}</small>
                  </article>
                  <article className="admin-stat">
                    <span className="admin-stat-label">Outstanding</span>
                    <strong>{formatRupees(data.summary.outstanding)}</strong>
                    <small>Owed by your customers</small>
                  </article>
                  <article className="admin-stat">
                    <span className="admin-stat-label">Visits completed</span>
                    <strong>{formatNumber(data.summary.visitsCompleted)} <em className="admin-stat-of">of {formatNumber(data.summary.visitsTotal)}</em></strong>
                    <small>{formatNumber(data.summary.followUpsOpen)} open follow-ups</small>
                  </article>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Salesperson</th>
                        <th className="numeric">Tally sales</th>
                        <th className="numeric">Target / month</th>
                        <th className="numeric">Customers</th>
                        <th className="numeric">Outstanding</th>
                        <th>CRM activity</th>
                        <th>Today</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <strong className="admin-cell-title">
                              {member.fullName}
                              {member.isSelf ? <span className="rm-you">You</span> : null}
                            </strong>
                            <small>{member.territory} · {member.email}</small>
                          </td>
                          <td className="numeric">{formatRupees(member.salesValue)}<small>{formatNumber(member.invoiceCount)} invoices</small></td>
                          <td className="numeric">{member.monthlyTarget > 0 ? `₹${formatNumber(member.monthlyTarget, 2)} Cr` : <span className="admin-muted">Not set</span>}</td>
                          <td className="numeric">{formatNumber(member.customerCount)}</td>
                          <td className="numeric">{formatRupees(member.outstanding)}</td>
                          <td>
                            <strong className="admin-cell-title">{formatNumber(member.visitsCompleted)} of {formatNumber(member.visitsTotal)} visits</strong>
                            <small>{formatNumber(member.followUpsOpen)} open follow-ups</small>
                          </td>
                          <td>
                            {member.attendance ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span className={`admin-pill ${member.attendance.checkOutAt ? "positive" : "neutral"}`} style={{ width: "fit-content" }}>
                                  {member.attendance.checkOutAt ? "Checked out" : "In field"}
                                </span>
                                <small style={{ fontSize: 10.5, color: "#64748b" }}>
                                  In: <strong>{new Date(member.attendance.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong>
                                  {member.attendance.checkOutAt && (
                                    <> · Out: <strong>{new Date(member.attendance.checkOutAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</strong></>
                                  )}
                                </small>
                              </div>
                            ) : (
                              <span className="admin-muted">Not checked in</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {soloBook && (
                  <p className="admin-note subtle">
                    No salespeople report to you yet, so this shows your own customer book. An administrator can assign
                    them under Users &amp; access.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
