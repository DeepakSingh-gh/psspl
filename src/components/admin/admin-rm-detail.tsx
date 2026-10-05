"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState, StatTile } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatRupees,
} from "@/lib/format";

type Tab =
  | "performance"
  | "visits"
  | "pipeline"
  | "sales"
  | "products"
  | "followups"
  | "insight";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "performance", label: "Performance" },
  { id: "visits", label: "Customer Visits" },
  { id: "pipeline", label: "Pipeline" },
  { id: "sales", label: "Actual Sales" },
  { id: "products", label: "Products" },
  { id: "followups", label: "Follow-ups" },
  { id: "insight", label: "AI Insight" },
];

type Period = "today" | "week" | "month" | "fytd";

function periodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = toStr(now);

  if (period === "today") return { from: today, to: today };

  if (period === "week") {
    const day = now.getDay(); // 0=Sun
    const start = new Date(now);
    start.setDate(now.getDate() - ((day + 6) % 7)); // Monday
    return { from: toStr(start), to: today };
  }

  if (period === "month") {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today };
  }

  // FYTD — Indian FY starts April
  const fyStart =
    now.getMonth() >= 3 // April = month 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);
  return { from: toStr(fyStart), to: today };
}

function achievementTone(pct: number | null): "positive" | "negative" | "neutral" | undefined {
  if (pct === null) return undefined;
  if (pct >= 100) return "positive";
  if (pct < 50) return "negative";
  return "neutral";
}

function achievementClass(pct: number | null): string {
  if (pct === null) return "";
  if (pct >= 100) return "positive";
  if (pct < 50) return "negative";
  return "neutral";
}

function InsightPanel({ data }: { data: any }) {
  const kpi = data.kpi;
  const topProduct = data.topProducts?.[0];
  const overdueCount = data.pipeline?.filter((p: any) => p.isOverdue).length ?? 0;

  const lines: string[] = [];
  lines.push(
    `${data.name} completed ${formatNumber(kpi.visitsCompleted)} customer visits` +
    (kpi.customersCovered > 0 ? `, covering ${formatNumber(kpi.customersCovered)} unique customers` : "") +
    " during the selected period."
  );

  if (kpi.expectedOrdersValue > 0 || kpi.actualSalesValue > 0) {
    lines.push(
      `The RM generated ${formatRupees(kpi.expectedOrdersValue)} in expected orders, while actual Tally sales stand at ${formatRupees(kpi.actualSalesValue)}.`
    );
  }

  if (topProduct) {
    lines.push(`${topProduct.name} is the strongest product, contributing ${formatRupees(topProduct.salesValue)} in sales.`);
  }

  const concerns: string[] = [];
  if (kpi.achievementPercent !== null && kpi.achievementPercent < 50) {
    concerns.push(`target achievement is critically low at ${formatPercent(kpi.achievementPercent)}`);
  }
  if (kpi.followUpsOpen > 0) {
    concerns.push(`${formatNumber(kpi.followUpsOpen)} follow-up${kpi.followUpsOpen > 1 ? "s" : ""} remain open`);
  }
  if (overdueCount > 0) {
    concerns.push(`${formatNumber(overdueCount)} pipeline order${overdueCount > 1 ? "s" : ""} are overdue`);
  }
  if (concerns.length > 0) {
    lines.push(`Main concern${concerns.length > 1 ? "s" : ""}: ${concerns.join("; ")}.`);
    lines.push("Management should review overdue follow-ups and pipeline conversion.");
  } else if (kpi.achievementPercent !== null && kpi.achievementPercent >= 90) {
    lines.push("Performance is on track. Continue monitoring pipeline for sustained growth.");
  }

  return (
    <div className="rm-insight">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export function AdminRmDetail({ rmId }: { rmId: string }) {
  const [tab, setTab] = useState<Tab>("performance");
  const [period, setPeriod] = useState<Period>("month");
  const { from, to } = periodDates(period);

  const { data, loading, error, reload } = useAdminData(
    () => adminApi.rmDetail(rmId, from, to),
    [rmId, from, to]
  );

  const kpi = data?.kpi;

  return (
    <>
      <Link href="/admin/team" className="rm-detail-back">
        ← Back to Team performance
      </Link>

      <AdminPage
        eyebrow="Team performance"
        title={data?.name ?? "RM Sales Activity"}
        description={
          data
            ? [data.region, "Sales Activity"].filter(Boolean).join(" · ")
            : "Loading…"
        }
        actions={
          <div className="rm-detail-period">
            {(["today", "week", "month", "fytd"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`rm-detail-period-btn${period === p ? " active" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "FYTD"}
              </button>
            ))}
          </div>
        }
      >
        <AdminState loading={loading} error={error} onRetry={reload} empty={false}>
          {data && kpi && (
            <>
              {/* KPI row */}
              <div className="admin-stats">
                <StatTile
                  label="Visits completed"
                  value={`${formatNumber(kpi.visitsCompleted)}${kpi.visitsPlanned > 0 ? ` / ${formatNumber(kpi.visitsPlanned)}` : ""}`}
                  sub="Planned vs completed"
                />
                <StatTile
                  label="Customers covered"
                  value={formatNumber(kpi.customersCovered)}
                  sub="Unique customers visited"
                />
                <StatTile
                  label="Expected orders"
                  value={formatRupees(kpi.expectedOrdersValue)}
                  sub="Open pipeline value"
                />
                <StatTile
                  label="Actual sales"
                  value={formatRupees(kpi.actualSalesValue)}
                  sub="Tally invoices in period"
                />
                <StatTile
                  label="Target achievement"
                  value={kpi.achievementPercent !== null ? formatPercent(kpi.achievementPercent) : "—"}
                  tone={achievementTone(kpi.achievementPercent)}
                  progress={kpi.achievementPercent}
                  sub={kpi.targetValue > 0 ? `Target: ${formatRupees(kpi.targetValue)}` : "No target set"}
                />
                <StatTile
                  label="Follow-ups open"
                  value={formatNumber(kpi.followUpsOpen)}
                  tone={kpi.followUpsOverdue > 0 ? "negative" : undefined}
                  sub={kpi.followUpsOverdue > 0 ? `${formatNumber(kpi.followUpsOverdue)} overdue` : "All on schedule"}
                />
              </div>

              {/* Tabs */}
              <div className="admin-tabs" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={tab === t.id ? "active" : undefined}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Performance tab ── */}
              {tab === "performance" && (
                <div className="rm-two-col">
                  {/* Target vs Actual */}
                  <div className="admin-card">
                    <header className="admin-card-header">
                      <div>
                        <p className="admin-eyebrow">Sales performance</p>
                        <h2>Target vs Actual</h2>
                      </div>
                    </header>
                    <div className="rm-progress-wrap">
                      <div className="rm-progress-labels">
                        <span>Actual: <strong>{formatRupees(kpi.actualSalesValue)}</strong></span>
                        <span>Target: <strong>{kpi.targetValue > 0 ? formatRupees(kpi.targetValue) : "Not set"}</strong></span>
                      </div>
                      <div className="rm-progress-bar">
                        <div
                          className="rm-progress-bar-fill"
                          style={{ width: `${Math.min(kpi.achievementPercent ?? 0, 100)}%` }}
                        />
                      </div>
                      <div className="rm-progress-labels">
                        <span className={kpi.achievementPercent !== null && kpi.achievementPercent < 50 ? "tone-negative" : kpi.achievementPercent !== null && kpi.achievementPercent >= 100 ? "tone-positive" : ""}>
                          {kpi.achievementPercent !== null ? `${formatPercent(kpi.achievementPercent)} achieved` : "No target set"}
                        </span>
                        {kpi.targetValue > 0 && kpi.actualSalesValue < kpi.targetValue && (
                          <span className="tone-negative">Gap: {formatRupees(kpi.targetValue - kpi.actualSalesValue)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Daily activity summary */}
                  <div className="admin-card">
                    <header className="admin-card-header">
                      <div>
                        <p className="admin-eyebrow">Field activity</p>
                        <h2>Daily breakdown</h2>
                      </div>
                    </header>
                    {data.dailyActivity.length === 0 ? (
                      <p className="admin-placeholder">No visits recorded in this period.</p>
                    ) : (
                      <div className="admin-table-wrap">
                        <table className="admin-table compact">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th className="numeric">Visits</th>
                              <th className="numeric">Customers</th>
                              <th className="numeric">Expected</th>
                              <th className="numeric">Actual Sales</th>
                              <th className="numeric">Follow-ups</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.dailyActivity.map((row: any) => (
                              <tr key={row.date}>
                                <td>{formatDate(row.date)}</td>
                                <td className="numeric">{formatNumber(row.visitsCount)}</td>
                                <td className="numeric">{formatNumber(row.customersCount)}</td>
                                <td className="numeric">{formatRupees(row.expectedValue)}</td>
                                <td className="numeric">{formatRupees(row.actualValue)}</td>
                                <td className="numeric">{formatNumber(row.followUpsCount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Customer Visits tab ── */}
              {tab === "visits" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">CRM field activity</p>
                      <h2>Customer visit log</h2>
                    </div>
                  </header>
                  {data.customerVisits.length === 0 ? (
                    <p className="admin-placeholder">No visits recorded in this period.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Purpose</th>
                            <th>Outcome</th>
                            <th className="numeric">Expected Order</th>
                            <th>Next Follow-up</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.customerVisits.map((v: any) => (
                            <tr key={v.id}>
                              <td>{formatDate(v.date)}</td>
                              <td><strong className="admin-cell-title">{v.customerName}</strong></td>
                              <td>
                                <span className={`admin-pill ${v.status === "completed" ? "positive" : v.status === "in_progress" ? "neutral" : ""}`}>
                                  {v.status ?? "—"}
                                </span>
                              </td>
                              <td>{v.purpose ?? <span className="admin-muted">—</span>}</td>
                              <td>{v.outcome ?? <span className="admin-muted">—</span>}</td>
                              <td className="numeric">{v.expectedOrderValue ? formatRupees(v.expectedOrderValue) : <span className="admin-muted">—</span>}</td>
                              <td>{v.nextFollowUpDate ? formatDate(v.nextFollowUpDate) : <span className="admin-muted">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Pipeline tab ── */}
              {tab === "pipeline" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Expected orders</p>
                      <h2>Sales pipeline</h2>
                    </div>
                  </header>
                  {data.pipeline.length === 0 ? (
                    <p className="admin-placeholder">No open expected orders.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Product</th>
                            <th className="numeric">Expected Value</th>
                            <th>Expected Date</th>
                            <th>Stage</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pipeline.map((p: any) => (
                            <tr key={p.id}>
                              <td><strong className="admin-cell-title">{p.customerName}</strong></td>
                              <td>{p.productName ?? <span className="admin-muted">—</span>}</td>
                              <td className="numeric"><strong>{formatRupees(p.expectedValue)}</strong></td>
                              <td>{p.expectedDate ? formatDate(p.expectedDate) : <span className="admin-muted">—</span>}</td>
                              <td>{p.stage ?? "open"}</td>
                              <td>
                                {p.isOverdue
                                  ? <span className="admin-pill negative">Overdue</span>
                                  : <span className="admin-pill positive">On track</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Actual Sales tab ── */}
              {tab === "sales" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Tally data</p>
                      <h2>Actual sales invoices</h2>
                    </div>
                    <div className="admin-card-header-right">
                      <dl className="admin-card-summary">
                        <div>
                          <dt>Total</dt>
                          <dd><strong>{formatRupees(kpi.actualSalesValue)}</strong></dd>
                        </div>
                        <div>
                          <dt>Invoices</dt>
                          <dd>{formatNumber(data.actualSales.length)}</dd>
                        </div>
                        <div>
                          <dt>Avg invoice</dt>
                          <dd>{data.actualSales.length > 0 ? formatRupees(kpi.actualSalesValue / data.actualSales.length) : "—"}</dd>
                        </div>
                      </dl>
                    </div>
                  </header>
                  {data.actualSales.length === 0 ? (
                    <p className="admin-placeholder">No Tally invoices found for this RM in the selected period.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Invoice #</th>
                            <th>Customer</th>
                            <th className="numeric">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.actualSales.map((s: any) => (
                            <tr key={s.id}>
                              <td>{formatDate(s.invoiceDate)}</td>
                              <td>{s.invoiceNumber ?? <span className="admin-muted">—</span>}</td>
                              <td><strong className="admin-cell-title">{s.customerName}</strong></td>
                              <td className="numeric"><strong>{formatRupees(s.amount)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Products tab ── */}
              {tab === "products" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Product performance</p>
                      <h2>Top products sold by {data.name}</h2>
                    </div>
                  </header>
                  {data.topProducts.length === 0 ? (
                    <p className="admin-placeholder">No product sales recorded in this period.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th className="numeric">Sales (this period)</th>
                            <th className="numeric">Previous period</th>
                            <th className="numeric">Growth</th>
                            <th className="numeric">Invoices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.topProducts.map((p: any) => (
                            <tr key={p.name}>
                              <td><strong className="admin-cell-title">{p.name}</strong></td>
                              <td className="numeric"><strong>{formatRupees(p.salesValue)}</strong></td>
                              <td className="numeric">{p.previousSalesValue > 0 ? formatRupees(p.previousSalesValue) : <span className="admin-muted">New</span>}</td>
                              <td className="numeric">
                                {p.growthPercent === null
                                  ? <span className="admin-muted">—</span>
                                  : <span className={p.growthPercent >= 0 ? "tone-positive" : "tone-negative"}>
                                      {p.growthPercent >= 0 ? "+" : ""}{formatPercent(p.growthPercent)}
                                    </span>}
                              </td>
                              <td className="numeric">{formatNumber(p.invoiceCount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Follow-ups tab ── */}
              {tab === "followups" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Action items</p>
                      <h2>Open follow-ups</h2>
                    </div>
                  </header>
                  {data.followUps.length === 0 ? (
                    <p className="admin-placeholder">No open follow-ups.</p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Customer</th>
                            <th>Due date</th>
                            <th>Priority</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.followUps.map((f: any) => (
                            <tr key={f.id}>
                              <td><strong className="admin-cell-title">{f.title}</strong></td>
                              <td>{f.customerName || <span className="admin-muted">—</span>}</td>
                              <td>{f.dueDate ? formatDate(f.dueDate) : <span className="admin-muted">—</span>}</td>
                              <td>
                                <span className={`admin-pill ${f.priority === "today" ? "negative" : f.priority === "high" ? "neutral" : ""}`}>
                                  {f.priority ?? "normal"}
                                </span>
                              </td>
                              <td>
                                {f.isOverdue
                                  ? <span className="admin-pill negative">Overdue</span>
                                  : <span className="admin-pill positive">Pending</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── AI Insight tab ── */}
              {tab === "insight" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">CRM intelligence</p>
                      <h2>AI Sales Insight — {data.name}</h2>
                    </div>
                  </header>
                  <InsightPanel data={data} />
                </div>
              )}
            </>
          )}
        </AdminState>
      </AdminPage>
    </>
  );
}
