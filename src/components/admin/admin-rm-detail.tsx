"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
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
  { id: "performance", label: "📊 Report Card" },
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
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - ((day + 6) % 7));
    return { from: toStr(start), to: today };
  }

  if (period === "month") {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today };
  }

  const fyStart =
    now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);
  return { from: toStr(fyStart), to: today };
}

/* ── helpers ── */
function monthsAgoLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (diff <= 0) return "This month";
  return `${diff} month${diff !== 1 ? "s" : ""} ago`;
}
function monthsAgoColor(dateStr: string | null | undefined): string {
  if (!dateStr) return "#d13a3a";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (diff <= 2) return "#e07c2d";
  if (diff <= 4) return "#c44a4a";
  return "#b03030";
}

/* ── Report Card "Performance" tab ── */
function ReportCardTab({ data, kpi, period }: { data: any; kpi: any; period: Period }) {
  const target = kpi.targetValue ?? 0;
  const actual = kpi.actualSalesValue ?? 0;
  const pct = kpi.achievementPercent ?? (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);
  const isUnder = pct < 50;
  const remaining = Math.max(0, target - actual);

  /* top dealers from actualSales — group by customer */
  const dealerMap: Record<string, number> = {};
  (data.actualSales ?? []).forEach((s: any) => {
    dealerMap[s.customerName] = (dealerMap[s.customerName] ?? 0) + s.amount;
  });
  const topDealers = Object.entries(dealerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, val]) => ({ dealerName: name, salesValue: val }));
  const dealerTotal = topDealers.reduce((s, d) => s + d.salesValue, 0) || 1;

  /* product total for share bars */
  const productTotal = (data.topProducts ?? []).reduce((s: number, p: any) => s + p.salesValue, 0) || 1;

  /* dormant: customers who have NOT appeared in actualSales but have history */
  const activeDealerNames = new Set((data.actualSales ?? []).map((s: any) => s.customerName));
  const dormant = (data.customerVisits ?? [])
    .filter((v: any) => !activeDealerNames.has(v.customerName))
    .reduce((acc: any[], v: any) => {
      if (!acc.find((x: any) => x.dealerName === v.customerName)) {
        acc.push({ dealerName: v.customerName, lastInvoice: null });
      }
      return acc;
    }, [])
    .slice(0, 5);

  /* AI insights */
  const insights: { color: string; icon: string; title: string; body: string }[] = [];
  if (pct < 50) insights.push({ color: "#e07c2d", icon: "📈", title: "Sales are low", body: `Only ${Math.round(pct)}% of target achieved. Increase focus on pending follow-ups and pipeline customers.` });
  if (dormant.length >= 2) insights.push({ color: "#c44a4a", icon: "👥", title: `${dormant.length} dealers are dormant`, body: `${dormant.slice(0, 2).map((d: any) => d.dealerName).join(" and ")} have not purchased recently. Schedule a visit.` });
  if (data.topProducts?.length > 0) insights.push({ color: "#1f7a55", icon: "📦", title: `${data.topProducts[0].name} is top product`, body: `${Math.round((data.topProducts[0].salesValue / productTotal) * 100)}% of total sales. Introduce it to more customers in the region.` });
  if (kpi.followUpsOverdue > 0) insights.push({ color: "#0663a0", icon: "🎯", title: `${kpi.followUpsOpen} follow-ups pending`, body: `${kpi.followUpsOverdue} follow-up${kpi.followUpsOverdue !== 1 ? "s" : ""} are overdue. Contact them this week to improve conversion.` });

  const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "FY to Date";

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* ── Profile + Performance Status banner ── */}
      <div style={bannerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={avatarStyle}>{data.name?.slice(0, 1) ?? "R"}</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0b2a5b" }}>{data.name}</h2>
            <p style={{ margin: "3px 0 0", color: "#5d7898", fontSize: 13 }}>RM – {data.region ?? "—"}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "#5d7898" }}>
              <span>📅 Period: <strong>{periodLabel}</strong></span>
              {target > 0 && <span>🎯 Monthly Target: <strong>{formatRupees(target)}</strong></span>}
            </div>
          </div>
        </div>
        {/* Performance Status Badge Card */}
        <div
          style={{
            background: isUnder
              ? "linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)"
              : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: `1px solid ${isUnder ? "#fca5a5" : "#86efac"}`,
            borderRadius: 12,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: isUnder
              ? "0 2px 8px rgba(220,38,38,0.08)"
              : "0 2px 8px rgba(22,163,74,0.08)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: isUnder ? "#dc2626" : "#16a34a",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              boxShadow: isUnder
                ? "0 4px 10px rgba(220,38,38,0.25)"
                : "0 4px 10px rgba(22,163,74,0.25)",
              flexShrink: 0,
            }}
          >
            {isUnder ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  color: isUnder ? "#991b1b" : "#166534",
                }}
              >
                Performance Status
              </span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: isUnder ? "#991b1b" : "#166534", lineHeight: 1.2, marginTop: 1 }}>
              {isUnder ? "Underperforming" : "On Track"}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isUnder ? "#b91c1c" : "#15803d",
                marginTop: 2,
              }}
            >
              {Math.round(pct)}% of target achieved
            </div>
          </div>
        </div>
      </div>

      {/* ── 6 KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <KpiCard icon="🎯" iconBg="#eaf5fc" label="Monthly Target" value={target > 0 ? formatRupees(target) : "Not set"} />
        <KpiCard icon="📊" iconBg="#e8f7ee" label="Actual Sales" value={formatRupees(actual)} />
        {/* Achievement */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff3e0", display: "grid", placeItems: "center", fontSize: 14 }}>%</span>
            <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Achievement</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: isUnder ? "#d13a3a" : "#1f7a55" }}>{Math.round(pct)}%</strong>
          <div style={{ marginTop: 6, height: 5, borderRadius: 4, background: "#f0f0f0", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: isUnder ? "#d13a3a" : "#1f7a55", borderRadius: 4, transition: "width .5s" }} />
          </div>
        </div>
        {/* Customers Visited */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eaf5fc", display: "grid", placeItems: "center", fontSize: 14 }}>👥</span>
            <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Customers Visited</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: "#0b2a5b" }}>{formatNumber(kpi.visitsCompleted)}</strong>
          <small style={{ fontSize: 11, color: "#5d7898" }}>of {formatNumber(kpi.visitsPlanned)} planned</small>
        </div>
        <KpiCard icon="📞" iconBg="#fff3e0" label="Customers Covered" value={formatNumber(kpi.customersCovered)} />
        {/* Follow-ups */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fef2f2", display: "grid", placeItems: "center", fontSize: 14 }}>🔔</span>
            <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Follow-ups Pending</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: "#d13a3a" }}>{formatNumber(kpi.followUpsOpen)}</strong>
          {kpi.followUpsOverdue > 0 && <small style={{ fontSize: 11, color: "#d13a3a", fontWeight: 600 }}>{kpi.followUpsOverdue} overdue</small>}
        </div>
      </div>

      {/* ── Row 2: Sales chart + Field Activity + Pipeline ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Sales vs Target */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>📈 Sales vs Target ({periodLabel})</p>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-end", height: 110, padding: "24px 12px 4px" }}>
            <div style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0b2a5b", marginBottom: 4 }}>{formatRupees(target)}</span>
              <div style={{ width: "100%", background: "#d9e5ef", borderRadius: "4px 4px 0 0", height: 64 }} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Target</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#087cc1", marginBottom: 4 }}>{formatRupees(actual)}</span>
              <div style={{ width: "100%", background: "#087cc1", borderRadius: "4px 4px 0 0", height: Math.max(6, Math.round((actual / Math.max(target, actual, 1)) * 64)) }} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5d7898", fontWeight: 600 }}>Actual</p>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#fef6f0", borderRadius: 8 }}>
            <strong style={{ color: "#d13a3a", fontSize: 15, fontWeight: 800 }}>{formatRupees(remaining)}</strong>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#d13a3a" }}>Remaining to reach target</p>
          </div>
        </div>

        {/* Field Activity */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>🚶 Field Activity ({periodLabel})</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
            <FieldStat
              icon="🚶"
              value={formatNumber(kpi.visitsCompleted)}
              label={
                <>
                  Visits<br />
                  <span style={{ fontSize: 10, color: "#8a9eb5" }}>
                    ({kpi.visitsPlanned > 0 ? Math.round((kpi.visitsCompleted / kpi.visitsPlanned) * 100) : 0}% of plan)
                  </span>
                </>
              }
              color="#1f7a55"
            />
            <FieldStat icon="📋" value={formatNumber(kpi.followUpsOpen)} label={<>Open<br />Follow-ups</>} color="#087cc1" />
            <FieldStat icon="👥" value={formatNumber(kpi.customersCovered)} label={<>Unique<br />Customers</>} color="#7c3aed" />
          </div>
        </div>

        {/* Pipeline */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>🛒 Pipeline (Expected Orders)</p>
          <strong style={{ fontSize: 22, fontWeight: 800, color: "#0b2a5b", display: "block", marginTop: 8 }}>{formatRupees(kpi.expectedOrdersValue)}</strong>
          <small style={{ color: "#5d7898", fontSize: 12 }}>Total pipeline value</small>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {(data.pipeline ?? []).slice(0, 4).map((p: any) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f4f8" }}>
                <span style={{ fontSize: 12, color: "#0b2a5b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.customerName}</span>
                <span style={{ fontSize: 12, color: "#087cc1", fontWeight: 700 }}>{formatRupees(p.expectedValue)}</span>
              </div>
            ))}
            {(data.pipeline ?? []).length === 0 && <p style={{ color: "#5d7898", fontSize: 12, margin: "8px 0 0" }}>No open pipeline orders</p>}
          </div>
        </div>
      </div>

      {/* ── Row 3: Top dealers + Dormant + Product performance ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Top 5 Dealers */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>👤 Top 5 Dealers by Revenue ({periodLabel})</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#5d7898" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Dealer Name</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Sales Value</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Share</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {topDealers.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#5d7898", padding: "16px 0" }}>No sales in this period</td></tr>
              ) : topDealers.map((d, i) => {
                const pctShare = Math.round((d.salesValue / dealerTotal) * 100);
                return (
                  <tr key={i} style={{ borderTop: "1px solid #f0f4f8" }}>
                    <td style={{ padding: "7px 4px", color: "#5d7898" }}>{i + 1}</td>
                    <td style={{ padding: "7px 4px", fontWeight: 600, color: "#0b2a5b" }}>{d.dealerName}</td>
                    <td style={{ padding: "7px 4px", textAlign: "right", color: "#0b2a5b" }}>{formatRupees(d.salesValue)}</td>
                    <td style={{ padding: "7px 4px", textAlign: "right", color: "#5d7898" }}>{pctShare}%</td>
                    <td style={{ padding: "7px 4px", width: 60 }}>
                      <div style={{ height: 5, borderRadius: 3, background: "#f0f4f8" }}>
                        <div style={{ height: "100%", width: `${pctShare}%`, background: "#087cc1", borderRadius: 3 }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dormant Dealers */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>🕐 Dormant Dealers (No purchase this period)</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#5d7898" }}>
                <th style={thStyle}>Dealer Name</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Last Invoice</th>
              </tr>
            </thead>
            <tbody>
              {dormant.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: "center", color: "#1f7a55", padding: "16px 0", fontWeight: 600 }}>✓ No dormant dealers</td></tr>
              ) : dormant.map((d: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #f0f4f8" }}>
                  <td style={{ padding: "8px 4px", fontWeight: 600, color: "#0b2a5b" }}>{d.dealerName}</td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>
                    <span style={{ background: monthsAgoColor(d.lastInvoice) + "22", color: monthsAgoColor(d.lastInvoice), borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {monthsAgoLabel(d.lastInvoice)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Product Performance */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>📦 Product Performance (Top 5)</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
            <thead>
              <tr style={{ color: "#5d7898" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Product</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Sales Value</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {(data.topProducts ?? []).length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "#5d7898", padding: "16px 0" }}>No product sales</td></tr>
              ) : (data.topProducts ?? []).map((p: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #f0f4f8" }}>
                  <td style={{ padding: "7px 4px", color: "#5d7898" }}>{i + 1}</td>
                  <td style={{ padding: "7px 4px", fontWeight: 600, color: "#0b2a5b" }}>{p.name}</td>
                  <td style={{ padding: "7px 4px", textAlign: "right", color: "#0b2a5b" }}>{formatRupees(p.salesValue)}</td>
                  <td style={{ padding: "7px 4px", width: 60 }}>
                    <div style={{ height: 5, borderRadius: 3, background: "#f0f4f8" }}>
                      <div style={{ height: "100%", width: `${Math.round((p.salesValue / productTotal) * 100)}%`, background: "#7c3aed", borderRadius: 3 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Key Insights ── */}
      {insights.length > 0 && (
        <div style={{ background: "#fffbf0", border: "1px solid #f0e0a0", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(11,42,91,.05)" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#0b2a5b", display: "flex", alignItems: "center", gap: 6 }}>
            💡 Key Insights &amp; Next Actions
            <span style={{ fontSize: 11, background: "#f5e090", borderRadius: 6, padding: "2px 8px", color: "#7a5c00" }}>AI Suggestions</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ background: "#fff", border: `1px solid ${ins.color}33`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{ins.icon}</span>
                  <strong style={{ fontSize: 12.5, color: ins.color }}>{ins.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#5d7898", lineHeight: 1.5 }}>{ins.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── AI Insight panel ── */
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

/* ── Main component ── */
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
        eyebrow="RM Report Card"
        title={data?.name ?? "RM Sales Activity"}
        description={
          data
            ? [data.region, "Complete view of sales, activity, customers and next action"].filter(Boolean).join(" · ")
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
              {/* Tabs */}
              <div className="admin-tabs" role="tablist" style={{ marginBottom: 24 }}>
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

              {/* ── Report Card tab ── */}
              {tab === "performance" && (
                <ReportCardTab data={data} kpi={kpi} period={period} />
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

/* ── sub-components ── */
function KpiCard({ icon, iconBg, label, value }: { icon: string; iconBg: string; label: string; value: string }) {
  return (
    <div style={kpiCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: "grid", placeItems: "center", fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#5d7898", fontWeight: 600 }}>{label}</span>
      </div>
      <strong style={{ fontSize: 20, fontWeight: 800, color: "#0b2a5b" }}>{value}</strong>
    </div>
  );
}

function FieldStat({ icon, value, label, color }: { icon: string; value: string; label: React.ReactNode; color: string }) {
  return (
    <div style={{ textAlign: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <strong style={{ display: "block", fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{value}</strong>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 4, lineHeight: 1.2, textAlign: "center", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ── shared styles ── */
const bannerStyle: React.CSSProperties = {
  background: "#ffffff", border: "1.5px solid #94a3b8", borderRadius: 14,
  padding: "20px 24px", marginBottom: 20,
  display: "flex", alignItems: "center", justifyContent: "space-between",
  boxShadow: "0 2px 8px rgba(15,23,42,.08)",
};
const avatarStyle: React.CSSProperties = {
  width: 60, height: 60, borderRadius: "50%",
  background: "linear-gradient(135deg,#087cc1 0%,#0b2a5b 100%)",
  display: "grid", placeItems: "center", color: "#fff",
  fontSize: 24, fontWeight: 700, flexShrink: 0,
};
const cardStyle: React.CSSProperties = {
  background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14,
  padding: "18px", boxShadow: "0 2px 8px rgba(15,23,42,.06)",
};
const cardTitleStyle: React.CSSProperties = {
  margin: 0, fontSize: 13.5, fontWeight: 750, color: "#0f172a",
  paddingBottom: 8, borderBottom: "1px solid #f1f5f9",
};
const kpiCardStyle: React.CSSProperties = {
  background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14,
  padding: "16px", boxShadow: "0 2px 8px rgba(15,23,42,.06)",
};
const thStyle: React.CSSProperties = {
  padding: "7px 6px", fontWeight: 700, textAlign: "left",
  fontSize: 11, color: "#475569", background: "#f8fafc",
  borderBottom: "1.5px solid #cbd5e1",
};

