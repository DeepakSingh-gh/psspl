"use client";

import { useState } from "react";
import quarterStyles from "./quarterly-trend.module.css";
import Link from "next/link";
import { AdminState } from "./admin-shell";
import { AskAiLauncher } from "./admin-ask-ai";
import { SalespersonMap } from "./salesperson-map";
import { adminApi, getSessionUser } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatFinancialYear, formatNumber, formatPercent, formatRupees } from "@/lib/format";

const monthShort = new Intl.DateTimeFormat("en-IN", { month: "short" });
const monthLong = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const periodDate = (period: string) => { const [year, month] = period.split("-").map(Number); return new Date(year, month - 1, 1); };
const periodShort = (period: string) => monthShort.format(periodDate(period));
const periodLong = (period: string) => monthLong.format(periodDate(period));

const TODAY = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const LEAD_STAGE_LABELS: Record<string, string> = {
  lead: "Lead", technical_discussion: "Technical discussion", sample: "Sample", quotation: "Quotation",
  follow_up: "Follow-up", expected_order: "Order expected", won: "Won", lost: "Lost",
};

/** Flat glyphs for the KPI chips — one weight, one 16px box. */
const KPI_ICONS: Record<string, React.ReactNode> = {
  revenue: <><path d="M2 11.5 6 7l3 2.5L14 4" /><path d="M10.5 4H14v3.5" /></>,
  target: <><circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="2" /></>,
  outstanding: <><rect x="2" y="4" width="12" height="8.5" rx="1.5" /><path d="M2 7h12" /></>,
  field: <><path d="M8 14s4.4-3.9 4.4-7.2A4.4 4.4 0 0 0 8 2.4a4.4 4.4 0 0 0-4.4 4.4C3.6 10.1 8 14 8 14Z" /><circle cx="8" cy="6.6" r="1.6" /></>,
};

function KpiCard({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub: React.ReactNode; tone?: "positive" | "negative" }) {
  return <article className="kpi">
    <header><p>{label}</p><span className={`kpi-chip is-${icon}`} aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{KPI_ICONS[icon]}</svg></span></header>
    <strong className={tone ? `tone-${tone}` : undefined}>{value}</strong>
    <small>{sub}</small>
  </article>;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function signedInName() {
  const local = getSessionUser()?.email?.split("@")[0] ?? "";
  const first = local.split(/[._-]/)[0];
  if (!first || ["admin", "administrator", "info", "sales", "office", "test"].includes(first.toLowerCase())) return null;
  return first[0].toUpperCase() + first.slice(1).toLowerCase();
}

type MonthlyRow = { period: string; salesValue: number; invoiceCount: number };

function RevenueHero({ rows, target }: { rows: MonthlyRow[]; target: number }) {
  const [active, setActive] = useState<number | null>(null);
  if (!rows.length) return <div className="command-empty">Revenue will appear after the next Tally sync.</div>;
  const width = 900, height = 250, left = 18, top = 28, bottom = 28;
  const monthlyTarget = target > 0 ? target / 12 : 0;
  const ceiling = Math.max(...rows.map((row) => row.salesValue), monthlyTarget, 1) * 1.08;
  const x = (index: number) => left + index * (width - left * 2) / Math.max(rows.length - 1, 1);
  const y = (value: number) => height - bottom - value / ceiling * (height - top - bottom);
  const points = rows.map((row, index) => `${x(index)},${y(row.salesValue)}`).join(" ");
  const area = `${x(0)},${height - bottom} ${points} ${x(rows.length - 1)},${height - bottom}`;
  const peak = rows.reduce((best, row, index) => row.salesValue > rows[best].salesValue ? index : best, 0);
  const selected = active === null ? null : rows[active];

  return <div className="command-chart" onMouseLeave={() => setActive(null)}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue performance by month">
      <defs><linearGradient id="commandRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#087cc1" stopOpacity=".18" /><stop offset="1" stopColor="#087cc1" stopOpacity="0" /></linearGradient></defs>
      {[.25, .5, .75].map((ratio) => <line key={ratio} x1={left} x2={width - left} y1={y(ceiling * ratio)} y2={y(ceiling * ratio)} className="command-gridline" />)}
      <polygon points={area} className="command-chart-area" />
      {monthlyTarget > 0 && <line x1={left} x2={width - left} y1={y(monthlyTarget)} y2={y(monthlyTarget)} className="command-target" />}
      <polyline points={points} className="command-revenue-line" />
      {rows.map((row, index) => <g key={row.period}>
        {index === peak && <><text x={x(index)} y={y(row.salesValue) - 18} textAnchor="middle" className="command-peak-label">PEAK · {formatRupees(row.salesValue)}</text><line x1={x(index)} x2={x(index)} y1={y(row.salesValue) - 13} y2={y(row.salesValue) - 6} className="command-peak-stem" /></>}
        <circle cx={x(index)} cy={y(row.salesValue)} r={active === index ? 5.5 : index === peak ? 4.5 : 3} className={`command-chart-dot${active === index ? " active" : ""}`} />
      </g>)}
      {rows.map((row, index) => { const before = index ? (x(index - 1) + x(index)) / 2 : 0; const after = index < rows.length - 1 ? (x(index) + x(index + 1)) / 2 : width; return <rect key={`hit-${row.period}`} x={before} y="0" width={after - before} height={height} className="command-chart-hit" onMouseEnter={() => setActive(index)} />; })}
    </svg>
    <div className="command-months">{rows.map((row, index) => <span className={index === rows.length - 1 ? "current" : ""} key={row.period}>{periodShort(row.period)}<small>{formatRupees(row.salesValue)}</small></span>)}</div>
    {selected && <div className="command-tooltip" style={{ left: `${Math.min(Math.max(x(active as number) / width * 100, 15), 85)}%` }}>
      <strong>{periodLong(selected.period)}</strong><dl><div><dt>Revenue</dt><dd>{formatRupees(selected.salesValue)}</dd></div>{monthlyTarget > 0 && <><div><dt>Target</dt><dd>{formatRupees(monthlyTarget)}</dd></div><div><dt>Achievement</dt><dd>{formatPercent(Math.round(selected.salesValue / monthlyTarget * 100))}</dd></div></>}</dl><small>{formatNumber(selected.invoiceCount)} invoices</small>
    </div>}
  </div>;
}

type Person = { userId: string; fullName: string; email: string; territory: string | null; region: string | null; checkInAt: string | null; checkOutAt: string | null; latitude: number | null; longitude: number | null; lastLocationAt: string | null };

function FieldMonitor({ people, checkedIn, visits, completed, followUps }: { people: Person[]; checkedIn: number; visits: number; completed: number; followUps: number }) {
  const located = people.filter((person) => person.latitude !== null && person.longitude !== null);
  return <div className="command-field">
    <div className="command-field-total"><strong>{checkedIn} / {people.length}</strong><span>checked in today</span></div>
    <div className="command-field-stats"><div><strong>{visits}</strong><span>Visits</span></div><div><strong>{completed}</strong><span>Completed</span></div><div><strong>{followUps}</strong><span>Follow-ups</span></div></div>
    <div className="command-roster">{people.slice(0, 5).map((person) => <Link href="/admin/activity" key={person.userId}><i className={person.checkInAt && !person.checkOutAt ? "live" : ""} /><span><strong>{person.fullName}</strong><small>{person.territory || person.region || "Territory not assigned"}</small></span><em>{person.checkInAt ? person.checkOutAt ? "Checked out" : "In field" : "Not checked in"}</em></Link>)}</div>
    {!located.length ? <div className="command-location-empty"><span>⌖</span><p><strong>No locations captured today</strong><small>Movement appears after a salesperson checks in.</small></p></div> : <Link className="command-location-live" href="/admin/activity"><span className="live-dot" />{located.length} live location{located.length === 1 ? "" : "s"}<b>View map →</b></Link>}
  </div>;
}

function AttentionCard({ tone, chip, title, detail, href, action }: { tone: "warn" | "critical" | "ok"; chip: string; title: string; detail: string; href: string; action: string }) {
  return <Link className={`attention-card is-${tone}`} href={href}>
    <header><i aria-hidden="true" /><span className="attention-chip">{chip}</span></header>
    <strong>{title}</strong>
    <small>{detail}</small>
    <b>{action} →</b>
  </Link>;
}

export function AdminOverview() {
  const [financialYear, setFinancialYear] = useState("");
  const overview = useAdminData(() => adminApi.overview(financialYear || undefined), [financialYear], `admin-overview-${financialYear || "default"}`, true);
  const alerts = useAdminData(() => adminApi.alerts(), [], undefined, true);
  const management = useAdminData(() => adminApi.managementAttention(financialYear || undefined), [financialYear], `admin-management-attention-${financialYear || "default"}`, true);
  const data = overview.data;

  const summaryLine = (() => {
    if (!data || !data.sales) return "Loading the latest synced figures…";
    const bits: string[] = [];
    const target = data.sales.target ?? 0;
    const actual = data.sales.actual ?? 0;
    const achieved = target > 0 ? Math.round((actual / target) * 100) : null;
    bits.push(`${formatRupees(actual)} billed this year`);
    if (achieved !== null) bits.push(`${achieved}% of target`);
    if (data.customers?.outstanding !== undefined) {
      bits.push(`${formatRupees(data.customers.outstanding)} outstanding`);
    }
    if (data.fieldActivity && data.charts?.salespersonLocations) {
      bits.push(`${data.fieldActivity.checkedInToday} of ${data.charts.salespersonLocations.length} reps checked in`);
    }
    return bits.join(" · ");
  })();

  return <main className="command">
    <header className="command-header">
      <div className="command-title">
        <p className="command-eyebrow">Executive dashboard · {TODAY.format(new Date())}</p>
        <h1>{greeting()}{signedInName() ? `, ${signedInName()}` : ""}</h1>
        <p className="command-subline">{summaryLine}</p>
      </div>
      <div className="command-tools">
        {data?.financialYears.length ? <select value={financialYear || data.financialYear || ""} onChange={(event) => setFinancialYear(event.target.value)}>{data.financialYears.map((year) => <option key={year} value={year}>{formatFinancialYear(year)}</option>)}</select> : null}
        <Link className="command-button" href="/admin/activity">Live field ops</Link>
        <Link className="command-button" href="/admin/reports">Sales report</Link>
      </div>
    </header>

    <AdminState loading={overview.loading} error={overview.error} onRetry={overview.reload}>{data && (() => {
      const months = data.charts.monthlySales;
      const invoices = months.reduce((sum, row) => sum + row.invoiceCount, 0);
      const achievement = data.sales.target > 0 ? Math.round(data.sales.actual / data.sales.target * 100) : null;
      const variance = data.sales.actual - data.sales.target;
      const team = data.charts.salespersonLocations;
      const coverage = team.length ? Math.round(data.fieldActivity.checkedInToday / team.length * 100) : 0;
      const outstandingShare = data.customers.lifetimeSales > 0 ? data.customers.outstanding / data.customers.lifetimeSales * 100 : null;
      const products = data.charts.productSales;
      const topProduct = products[0];
      const maxProduct = topProduct?.salesValue || 1;
      const unassigned = data.customers.unassigned;
      const notCheckedIn = Math.max(team.length - data.fieldActivity.checkedInToday, 0);
      const overdue = alerts.data?.summary.overdueFollowUps ?? 0;
      const managementTeam = management.data?.team ?? [];
      const performanceRows = [...managementTeam].sort((a, b) => {
        const aScore = a.monthlyPerformance.achievementPercent ?? a.ytdPerformance.achievementPercent;
        const bScore = b.monthlyPerformance.achievementPercent ?? b.ytdPerformance.achievementPercent;
        if (aScore == null && bScore != null) return 1;
        if (aScore != null && bScore == null) return -1;
        return aScore == null || bScore == null ? a.name.localeCompare(b.name) : aScore - bScore;
      });
      const missingTargetRms = managementTeam.filter((rm) => rm.ownershipMapping === "verified" && rm.monthlyPerformance.target === null && rm.ytdPerformance.target === null);
      const actions = [
        ...managementTeam.flatMap((rm) => rm.actions.filter((item) => item.kind === "target-risk").map((item) => ({
          key: item.id, tone: "critical" as const, priority: 0,
          title: `${rm.name} · ${item.metric}`,
          detail: `${item.actual == null ? "Sales unavailable" : formatRupees(item.actual)} actual against ${item.target == null ? "target unavailable" : formatRupees(item.target)} target. ${item.action}`,
          href: item.href, action: "Open RM report card",
        }))),
        ...(alerts.data?.overdueFollowUps ?? []).slice(0, 5).map((item) => ({
          key: `followup-${item.id}`, tone: "critical" as const, priority: 1,
          title: `${item.customer || item.title} · ${item.daysOverdue} days overdue`,
          detail: `Owner: ${item.fullName}. Follow-up “${item.title}” was due ${item.dueDate}.`,
          href: "/admin/alerts", action: "Review follow-up",
        })),
        ...(management.data?.dealerActions ?? []).map((item) => ({
          key: item.id, tone: "warn" as const, priority: 2,
          title: `${item.dealerName} · ${item.title}`,
          detail: `${item.rmName} · ${item.metric} during ${item.period.from} to ${item.period.to}. ${item.action}`,
          href: item.href, action: "Open dealer record",
        })),
        ...(managementTeam.flatMap((rm) => rm.actions.filter((item) => item.kind === "dealer-concentration").map((item) => ({
          key: item.id, tone: "warn" as const, priority: 4,
          title: `${rm.name} · ${item.title}`,
          detail: `${item.metric} for ${item.period.from} to ${item.period.to}. Top dealers: ${rm.concentrationTopDealers.map((dealer) => dealer.name).join(", ") || "unavailable"}. ${item.action}`,
          href: item.href, action: "Open RM report card",
        })))),
        ...(management.data?.visits.pastScheduled ?? []).slice(0, 5).map((item) => ({
          key: `past-visit-${item.id}`, tone: "warn" as const, priority: 3,
          title: `${item.customerName} · scheduled visit not recorded complete`,
          detail: `${item.rmName} / ${item.ownerName} · ${item.scheduledAt}. ${item.action}`,
          href: item.href, action: "Review visit record",
        })),
        ...(management.data?.visits.pendingToday ?? []).filter((item) => !item.pastScheduledTime).slice(0, 3).map((item) => ({
          key: `pending-visit-${item.id}`, tone: "warn" as const, priority: 3,
          title: `${item.customerName} · visit planned today`,
          detail: `${item.rmName} / ${item.ownerName} · ${item.scheduledAt}. ${item.action}`,
          href: item.href, action: "Review visit plan",
        })),
        ...managementTeam.filter((rm) => rm.ownershipMapping !== "verified").map((rm) => ({
          key: `mapping-${rm.id}`, tone: "warn" as const, priority: 5,
          title: `${rm.name} · RM ownership ${rm.ownershipMapping}`,
          detail: "RM sales and dealer attribution are withheld until the active CRM team mapping is unique and verified.",
          href: "/admin/team", action: "Review team mapping",
        })),
        ...(data.customers.unassigned > 0 ? [{
          key: "unmapped-customers", tone: "warn" as const, priority: 5,
          title: `${formatNumber(data.customers.unassigned)} customers lack a verified owner`,
          detail: "Sales attribution is incomplete for these accounts. Assign an owner only after confirming the CRM relationship.",
          href: "/admin/customers", action: "Review customer ownership",
        }] : []),
        ...(!data.tally.connected ? [{
          key: "tally-unavailable", tone: "critical" as const, priority: 6,
          title: "Tally connector is not connected",
          detail: data.tally.message || "Current accounting figures may be stale. Confirm connector health before acting on revenue metrics.",
          href: "/admin/reports", action: "Review sales report",
        }] : []),
        ...(management.data?.sync.needsReview ? [{
          key: `tally-sync-${management.data.sync.latestRun?.id}`, tone: "critical" as const, priority: 6,
          title: `Latest Tally sync requires review (${management.data.sync.latestRun?.status})`,
          detail: `Sync started ${management.data.sync.latestRun?.startedAt}; revenue freshness should be verified before management decisions.`,
          href: "/admin/reports", action: "Review sync status",
        }] : []),
      ].sort((a, b) => a.priority - b.priority).filter((item, index, rows) => rows.findIndex((candidate) => candidate.key === item.key) === index).slice(0, 16);
      return <>
        <section className="kpis" aria-label="Executive summary">
          <KpiCard icon="revenue" label="Revenue" value={formatRupees(data.sales.actual)}
            sub={<>{formatNumber(invoices)} invoices{achievement !== null && <> · <b className={achievement >= 100 ? "tone-positive" : "tone-negative"}>{achievement >= 100 ? "+" : "−"}{Math.abs(achievement - 100)}% vs target</b></>}</>} />
          <KpiCard icon="target" label="Target achievement" value={achievement === null ? "Not set" : formatPercent(achievement)}
            tone={achievement === null ? undefined : achievement >= 100 ? "positive" : "negative"}
            sub={data.sales.hasTargets ? <>{formatRupees(data.sales.target)} target · {variance >= 0 ? "+" : "−"}{formatRupees(Math.abs(variance))}</> : "No target for this year"} />
          <KpiCard icon="outstanding" label="Outstanding" value={formatRupees(data.customers.outstanding)}
            sub={<>{formatNumber(data.customers.count)} customers{outstandingShare !== null && <> · {outstandingShare.toFixed(1)}% of billed</>}</>} />
          <KpiCard icon="field" label="Field coverage today" value={formatPercent(coverage)}
            sub={<>{data.fieldActivity.checkedInToday} of {team.length} checked in · {data.fieldActivity.visitsToday} visits</>} />
        </section>

        <section className="command-story">
          <div className="command-revenue"><header><div><p>Revenue performance</p><h2>How the business is moving</h2></div><Link href="/admin/reports">Detailed report →</Link></header><RevenueHero rows={months} target={data.sales.target} /></div>
        </section>

        <section className="command-products" aria-label="Lead pipeline">
          <header><div><p>CRM pipeline · current</p><h2>Lead pipeline</h2></div><span>{formatNumber(data.leadPipeline.total)} total leads</span></header>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
            {Object.entries(LEAD_STAGE_LABELS).map(([stage, label]) => {
              const row = data.leadPipeline.stages.find((item) => item.stage === stage);
              return <div key={stage} style={{ border: "1px solid #dbe6ef", borderRadius: 10, padding: 12, background: "#f8fbfe" }}>
                <small>{label}</small><strong style={{ display: "block", fontSize: 22 }}>{row?.count ?? 0}</strong>
                <small>{formatRupees(row?.expectedValue ?? 0)} expected</small>
              </div>;
            })}
          </div>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Lead / customer</th><th>RM</th><th>Stage</th><th className="numeric">Expected value</th></tr></thead>
            <tbody>{data.leadPipeline.recent.map((lead) => <tr key={lead.id}>
              <td><strong className="admin-cell-title">{lead.company || lead.name}</strong>{lead.company && lead.name !== lead.company ? <small>{lead.name}</small> : null}</td>
              <td>{lead.ownerName}</td><td>{LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}</td>
              <td className="numeric">{formatRupees(lead.expectedValue)}</td>
            </tr>)}</tbody>
          </table>{!data.leadPipeline.recent.length && <p className="command-data-note">No leads have been recorded yet. A completed customer visit will appear here.</p>}</div>
        </section>

        {/* Quarter-wise Trend Analysis */}
        {(() => {
          const quarters = months.reduce((acc: any[], row) => {
            const month = parseInt(row.period.slice(5));
            const qIndex = month >= 4 ? Math.floor((month - 4) / 3) : Math.floor((month + 8) / 3);
            const qNames = ["Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"];
            const qName = qNames[qIndex];
            const existing = acc.find(q => q.name === qName);
            if (existing) {
              existing.salesValue += row.salesValue;
            } else {
              acc.push({ name: qName, salesValue: row.salesValue, qIndex });
            }
            return acc;
          }, []).sort((a, b) => a.qIndex - b.qIndex);
          return quarters.length > 0 && (
            <section className={quarterStyles.card} aria-label="Quarter-wise Trend">
              <header className={quarterStyles.header}>
                <div><p className={quarterStyles.eyebrow}>Quarterly analysis</p><h2>Quarter-wise Trend</h2></div>
                <span className={quarterStyles.tag}>Recorded sales</span>
              </header>
              <div className={quarterStyles.grid}>
                {quarters.map((q) => (
                  <article key={q.name} className={quarterStyles.quarter}>
                    <div className={quarterStyles.period}><span className={quarterStyles.badge}>Q{q.qIndex + 1}</span><span>{q.name.slice(4, -1)}</span></div>
                    <strong className={quarterStyles.value}>{formatRupees(q.salesValue)}</strong>
                    <div className={quarterStyles.track} aria-hidden="true">
                      <span style={{ width: `${Math.max(0, Math.min((q.salesValue / (Math.max(...quarters.map(qx => qx.salesValue)) || 1)) * 100, 100))}%` }} />
                    </div>
                  </article>
                ))}
              </div>
              <p className={quarterStyles.note}>Bars compare recorded sales across the quarters shown. Current-quarter figures may be partial.</p>
            </section>
          );
        })()}

        <section className="command-money-field">
          <article className="command-field-zone"><header><div><p>Today</p><h2>Field activity</h2></div><Link href="/admin/activity">Open activity →</Link></header><FieldMonitor people={team} checkedIn={data.fieldActivity.checkedInToday} visits={data.fieldActivity.visitsToday} completed={data.fieldActivity.visitsCompleted} followUps={data.fieldActivity.followUpsOpen} /></article>
        </section>

        <section className="command-map"><SalespersonMap people={team} /></section>

        <section className="command-products"><header><div><p>Business mix</p><h2>Revenue by product</h2></div><Link href="/admin/products">All products →</Link></header><div className="command-product-layout"><ol>{products.slice(0, 5).map((product, index) => { const share = data.sales.actual > 0 ? product.salesValue / data.sales.actual * 100 : 0; return <li key={product.name}><span>{String(index + 1).padStart(2, "0")}</span><div><p><strong>{product.name}</strong><b>{formatRupees(product.salesValue)}</b></p><div><i style={{ width: `${Math.max(product.salesValue / maxProduct * 100, 2)}%` }} /></div><small>{formatNumber(product.quantity)} units · {share.toFixed(1)}% of revenue</small></div></li>; })}</ol>{topProduct && <aside><p>Top product</p><strong>{formatRupees(topProduct.salesValue)}</strong><span>{topProduct.name}</span><small>{data.sales.actual > 0 ? `${(topProduct.salesValue / data.sales.actual * 100).toFixed(1)}% of revenue` : ""}</small></aside>}</div></section>

        <section className="attention-panel">
          <header>
            <div>
              <h2>Needs attention <span className="attention-count">{[data.customers.outstanding > 0, notCheckedIn > 0, unassigned > 0, overdue > 0].filter(Boolean).length}</span></h2>
              <p>Signals drawn from the live Tally ledger and CRM activity</p>
            </div>
            <Link href="/admin/alerts">All alerts →</Link>
          </header>
          <div className="attention-grid">
            <AttentionCard tone="warn" chip={outstandingShare === null ? "Ledger" : `${outstandingShare.toFixed(1)}% of billed`}
              title={`${formatRupees(data.customers.outstanding)} outstanding`} detail={`${formatNumber(data.customers.count)} customers in the ledger`}
              href="/admin/customers" action="View receivables" />
            <AttentionCard tone={notCheckedIn ? "warn" : "ok"} chip={notCheckedIn ? "Today" : "Complete"}
              title={`${notCheckedIn} ${notCheckedIn === 1 ? "salesperson without a check-in" : "salespeople without a check-in"}`}
              detail={notCheckedIn ? "No attendance recorded today" : "Field attendance is complete"}
              href="/admin/activity" action="View field activity" />
            <AttentionCard tone={unassigned ? "critical" : "ok"} chip={data.customers.count ? `${Math.round(unassigned / data.customers.count * 100)}% of ledger` : "—"}
              title={`${formatNumber(unassigned)} customers have no owner`}
              detail={unassigned ? "Sales cannot be attributed to a territory" : "Every customer has an owner"}
              href="/admin/customers" action="Assign owners" />
            <AttentionCard tone={overdue ? "critical" : "ok"} chip={overdue ? "Overdue" : "On track"}
              title={`${formatNumber(overdue)} follow-ups overdue`}
              detail={overdue ? "Customer commitments need action" : "Follow-ups are currently on track"}
              href="/admin/alerts" action="Review follow-ups" />
          </div>
        </section>
        <section className="attention-panel" aria-label="Prioritized management actions">
          <header>
            <div><h2>Today’s management actions <span className="attention-count">{actions.length}</span></h2>
              <p>Prioritized from Tally and saved CRM records{management.data?.thresholds.provisional ? " · configured review thresholds are provisional" : ""}</p></div>
            <Link href="/admin/team">Review team →</Link>
          </header>
          {management.loading && <p className="command-data-note">Loading RM performance and activity…</p>}
          {management.error && <p className="command-data-note" role="alert">Management data could not be loaded: {management.error} <button type="button" onClick={management.reload}>Retry</button></p>}
          {missingTargetRms.length > 0 && <p className="command-data-note">{missingTargetRms.length} RM{missingTargetRms.length === 1 ? " has" : "s have"} no comparable target and are excluded from performance ranking. Review targets in Users &amp; access.</p>}
          {management.data && !actions.length ? <p className="command-data-note">No matching actions were returned by the current data sources.</p> :
            <div className="attention-grid">{actions.map((item) => <AttentionCard key={item.key} tone={item.tone} chip={item.priority === 0 ? "RM performance" : item.priority === 1 ? "Overdue" : item.priority === 2 ? "Dealer" : item.priority === 3 ? "Visit" : item.priority === 4 ? "Concentration" : item.priority === 5 ? "Mapping" : "Tally"} title={item.title} detail={item.detail} href={item.href} action={item.action} />)}</div>}
          {!data.tally.lastSyncAt && <p className="command-data-note">Tally sync time is unavailable; financial figures should be reviewed for freshness.</p>}
        </section>
        <section className="command-products" aria-label="RM MTD and FYTD performance">
          <header><div><p>Authoritative Tally performance · {management.data?.financialYear ? formatFinancialYear(management.data.financialYear) : "selected financial year"}</p><h2>RM MTD and FYTD comparison</h2></div><Link href="/admin/team">Full team report →</Link></header>
          {management.data && <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>RM</th><th className="numeric">MTD actual / target</th><th className="numeric">MTD achieved</th><th className="numeric">FYTD actual / target</th><th className="numeric">FYTD achieved</th><th>Mapping</th></tr></thead>
            <tbody>{performanceRows.map((rm) => <tr key={rm.id}>
              <td><Link href={`/admin/team/${encodeURIComponent(rm.id)}?from=${encodeURIComponent(management.data!.period.fyFrom)}&to=${encodeURIComponent(management.data!.period.to)}&fy=${encodeURIComponent(management.data!.financialYear)}`}>{rm.name}</Link></td>
              <td className="numeric">{rm.monthlyPerformance.actual == null ? "Unavailable" : formatRupees(rm.monthlyPerformance.actual)} / {rm.monthlyPerformance.target == null ? "No target" : formatRupees(rm.monthlyPerformance.target)}</td>
              <td className="numeric">{rm.monthlyPerformance.achievementPercent == null ? <span className="admin-muted">Unavailable</span> : formatPercent(rm.monthlyPerformance.achievementPercent)}</td>
              <td className="numeric">{rm.ytdPerformance.actual == null ? "Unavailable" : formatRupees(rm.ytdPerformance.actual)} / {rm.ytdPerformance.target == null ? "No target" : formatRupees(rm.ytdPerformance.target)}</td>
              <td className="numeric">{rm.ytdPerformance.achievementPercent == null ? <span className="admin-muted">Unavailable</span> : formatPercent(rm.ytdPerformance.achievementPercent)}</td>
              <td>{rm.ownershipMapping === "verified" ? "Verified" : rm.ownershipMapping}</td>
            </tr>)}</tbody>
          </table></div>}
        </section>
      </>;
    })()}</AdminState>
  </main>;
}
