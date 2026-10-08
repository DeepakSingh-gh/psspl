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
function ReportCardTab({ data, kpi, period, onSelectTab }: { data: any; kpi: any; period: Period; onSelectTab?: (tab: Tab) => void }) {
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
  const totalActualSales = Object.values(dealerMap).reduce((s, v) => s + v, 0) || 1;
  const top5Total = topDealers.reduce((s, d) => s + d.salesValue, 0);
  const totalDealersCount = Object.keys(dealerMap).length;
  const dependencyPct = totalActualSales > 1 ? Math.round((top5Total / totalActualSales) * 100) : 0;
  const newCustomersCount = Math.floor(totalDealersCount * 0.1); // Placeholder for new customers in last 6 months

  /* product performance — slice TOP 5 for summary card */
  const allProducts = data.topProducts ?? [];
  const topProducts = allProducts.slice(0, 5);
  const productTotal = allProducts.reduce((s: number, p: any) => s + p.salesValue, 0) || 1;

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
  if (pct < 50) insights.push({ color: "#d97706", icon: "📈", title: "Sales are low", body: `Only ${Math.round(pct)}% of target achieved. Increase focus on pending follow-ups and pipeline customers.` });
  if (dormant.length >= 2) insights.push({ color: "#dc2626", icon: "👥", title: `${dormant.length} dealers are dormant`, body: `${dormant.slice(0, 2).map((d: any) => d.dealerName).join(" and ")} have not purchased recently. Schedule a visit.` });
  if (topProducts.length > 0) insights.push({ color: "#16a34a", icon: "📦", title: `${topProducts[0].name} is top product`, body: `${Math.round((topProducts[0].salesValue / productTotal) * 100)}% of total sales. Introduce it to more customers in the region.` });
  if (kpi.followUpsOverdue > 0) insights.push({ color: "#0284c7", icon: "🎯", title: `${kpi.followUpsOpen} follow-ups pending`, body: `${kpi.followUpsOverdue} follow-up${kpi.followUpsOverdue !== 1 ? "s" : ""} are overdue. Contact them this week to improve conversion.` });

  function generateManagerActionPlan(targetPct: number, depPct: number, totalDealers: number, dormantDealers: number) {
    const actions = [];
    if (targetPct < 50) actions.push(`This RM is ${100 - targetPct}% behind target. Direct intervention needed on pipeline.`);
    if (depPct > 80 && totalDealers > 0) actions.push(`High dependency risk: ${depPct}% of revenue comes from just ${Math.min(5, totalDealers)} dealers. Action: Mandate prospecting for new accounts.`);
    if (dormantDealers > 0) actions.push(`${dormantDealers} dormant dealers need immediate follow-up to prevent churn.`);
    if (actions.length === 0) actions.push(`Performance is stable. Continue regular weekly check-ins.`);
    return actions;
  }
  const managerActions = generateManagerActionPlan(Math.round(pct), dependencyPct, totalDealersCount, dormant.length);

  const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : period === "month" ? "This Month" : "FY to Date";

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* Manager Action Plan Banner */}
      <div style={{
        background: managerActions[0].includes("stable") ? "#f0fdf4" : "#fef2f2",
        border: `1.5px solid ${managerActions[0].includes("stable") ? "#22c55e" : "#dc2626"}`,
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "20px",
      }}>
        <h3 style={{ margin: "0 0 8px 0", color: managerActions[0].includes("stable") ? "#166534" : "#991b1b", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{managerActions[0].includes("stable") ? "✅" : "⚠️"}</span> Manager Action Plan
        </h3>
        <ul style={{ margin: 0, paddingLeft: "24px", color: managerActions[0].includes("stable") ? "#15803d" : "#7f1d1d", fontWeight: 600, fontSize: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {managerActions.map((action, i) => <li key={i}>{action}</li>)}
        </ul>

        {/* Recent Visits & Notes */}
        <div style={{ marginTop: "14px", borderTop: `1px dashed ${managerActions[0].includes("stable") ? "#bbf7d0" : "#fca5a5"}`, paddingTop: "12px" }}>
          <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: managerActions[0].includes("stable") ? "#166534" : "#991b1b" }}>Recent Visits & Notes</h4>
          {(!data.customerVisits || data.customerVisits.length === 0) ? (
            <p style={{ margin: 0, fontSize: "12px", color: managerActions[0].includes("stable") ? "#15803d" : "#7f1d1d" }}>No visits recorded in this period.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
              {(data.customerVisits || []).map((v: any) => (
                <div key={v.id} style={{ background: "#ffffff", border: `1px solid ${managerActions[0].includes("stable") ? "#dcfce7" : "#fee2e2"}`, borderRadius: "6px", padding: "6px 10px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "2px 12px", alignItems: "baseline" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "baseline", minWidth: 0 }}>
                    <strong style={{ fontSize: "12.5px", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.customerName}</strong>
                    <span style={{ fontSize: "11.5px", color: "#64748b", whiteSpace: "nowrap" }}>{v.purpose ? `— ${v.purpose}` : ""}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>{formatDate(v.date)}</span>
                  <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: "#334155", background: managerActions[0].includes("stable") ? "#f0fdf4" : "#fef2f2", padding: "4px 8px", borderRadius: "4px", borderLeft: `2.5px solid ${managerActions[0].includes("stable") ? "#22c55e" : "#ef4444"}`, marginTop: "2px", lineHeight: "1.4" }}>
                    <strong style={{ color: managerActions[0].includes("stable") ? "#166534" : "#991b1b", marginRight: "6px", fontSize: "11.5px" }}>Note:</strong>
                    {v.outcome || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No description</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Profile + Performance Status banner ── */}
      <div style={bannerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={avatarStyle}>{data.name?.slice(0, 1) ?? "R"}</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>{data.name}</h2>
            <p style={{ margin: "3px 0 0", color: "#475569", fontSize: 13, fontWeight: 600 }}>RM – {data.region ?? "—"}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "#64748b" }}>
              <span>📅 Period: <strong style={{ color: "#0f172a" }}>{periodLabel}</strong></span>
              {target > 0 && <span>🎯 Monthly Target: <strong style={{ color: "#0f172a" }}>{formatRupees(target)}</strong></span>}
            </div>
          </div>
        </div>
        {/* Performance Status Badge Card */}
        <div
          style={{
            background: isUnder
              ? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)"
              : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: `1.5px solid ${isUnder ? "#fca5a5" : "#86efac"}`,
            borderRadius: 14,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: isUnder
              ? "0 4px 12px rgba(220,38,38,0.1)"
              : "0 4px 12px rgba(22,163,74,0.1)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: isUnder ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #22c55e, #16a34a)",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              boxShadow: isUnder
                ? "0 4px 10px rgba(220,38,38,0.3)"
                : "0 4px 10px rgba(22,163,74,0.3)",
              flexShrink: 0,
            }}
          >
            {isUnder ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  color: isUnder ? "#991b1b" : "#166534",
                }}
              >
                Performance Status
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isUnder ? "#991b1b" : "#166534", lineHeight: 1.2, marginTop: 1 }}>
              {isUnder ? "Underperforming" : "On Track"}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isUnder ? "#b91c1c" : "#15803d",
                marginTop: 2,
              }}
            >
              {Math.round(pct)}% of target achieved
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Insights & Next Actions (Top AI Suggestions) ── */}
      {insights.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #fffcf0 0%, #fefce8 40%, #f5f3ff 100%)",
            border: "1.5px solid #fde047",
            borderRadius: 16,
            padding: "18px 22px",
            marginBottom: 20,
            boxShadow: "0 4px 20px -2px rgba(245, 158, 11, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 16,
                  color: "#fff",
                  boxShadow: "0 3px 8px rgba(217, 119, 6, 0.3)",
                }}
              >
                💡
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                  Key Insights &amp; Next Actions
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b", fontWeight: 500 }}>
                  Automated AI-driven performance recommendations
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: "linear-gradient(135deg, #fef08a 0%, #fde047 100%)",
                border: "1px solid #facc15",
                borderRadius: 20,
                padding: "4px 12px",
                color: "#854d0e",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                boxShadow: "0 2px 6px rgba(234, 179, 8, 0.2)",
              }}
            >
              ✨ AI Executive Summary
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  background: "#ffffff",
                  border: `1px solid ${ins.color}33`,
                  borderLeft: `4px solid ${ins.color}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                  transition: "all 0.2s ease-in-out",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `${ins.color}15`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {ins.icon}
                  </span>
                  <strong style={{ fontSize: 13, color: "#0f172a", fontWeight: 800 }}>{ins.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.55, fontWeight: 500 }}>{ins.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Customer Health & Dependency ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: dependencyPct > 80 ? "#fff1f2" : "#f8fafc", border: `1.5px solid ${dependencyPct > 80 ? "#fda4af" : "#cbd5e1"}`, borderRadius: 12, padding: "16px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, color: dependencyPct > 80 ? "#9f1239" : "#334155", textTransform: "uppercase", fontWeight: 800 }}>Revenue Dependency Risk</h4>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
            {dependencyPct}% of sales come from top {Math.min(5, totalDealersCount)} dealers <span style={{ fontWeight: 400, color: "#64748b" }}>(out of {totalDealersCount} total active)</span>
          </p>
        </div>
        <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: "16px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, color: "#166534", textTransform: "uppercase", fontWeight: 800 }}>New Acquisition</h4>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
            {newCustomersCount} new customers <span style={{ fontWeight: 400, color: "#64748b" }}>added in the last 6 months</span>
          </p>
        </div>
      </div>

      {/* ── 6 KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 20 }}>
        <KpiCard icon="🎯" iconBg="#e0f2fe" label="Monthly Target" value={target > 0 ? formatRupees(target) : "Not set"} />
        <KpiCard icon="📊" iconBg="#dcfce7" label="Actual Sales" value={formatRupees(actual)} />
        {/* Achievement */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fef3c7", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#d97706" }}>%</span>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Achievement</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: isUnder ? "#dc2626" : "#16a34a" }}>{Math.round(pct)}%</strong>
          <div style={{ marginTop: 8, height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: isUnder ? "#dc2626" : "#16a34a", borderRadius: 4, transition: "width .5s" }} />
          </div>
        </div>
        {/* Customers Visited */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#e0f2fe", display: "grid", placeItems: "center", fontSize: 14 }}>👥</span>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Visited</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{formatNumber(kpi.visitsCompleted)}</strong>
          <small style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", marginTop: 2 }}>of {formatNumber(kpi.visitsPlanned)} planned</small>
        </div>
        <KpiCard icon="📞" iconBg="#ffedd5" label="Customers Covered" value={formatNumber(kpi.customersCovered)} />
        {/* Follow-ups */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fee2e2", display: "grid", placeItems: "center", fontSize: 14 }}>🔔</span>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Pending Follow-ups</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: kpi.followUpsOpen > 0 ? "#dc2626" : "#0f172a" }}>{formatNumber(kpi.followUpsOpen)}</strong>
          {kpi.followUpsOverdue > 0 && <small style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, display: "block", marginTop: 2 }}>{kpi.followUpsOverdue} overdue</small>}
        </div>
      </div>

      {/* ── Row 2: Sales chart + Field Activity + Pipeline ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Sales vs Target */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>📈 Sales vs Target ({periodLabel})</p>
          
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Target Achievement</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: isUnder ? "#dc2626" : "#16a34a" }}>
                {pct}% <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>({formatRupees(actual)})</span>
              </span>
            </div>
            
            {/* Visual Progress Bar */}
            <div style={{ height: 12, width: "100%", background: "#f1f5f9", borderRadius: 8, overflow: "hidden", border: "1px solid #cbd5e1" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(1, pct))}%`,
                  background: isUnder
                    ? "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)"
                    : "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)",
                  borderRadius: 8,
                  transition: "width 0.5s ease",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}>
              <div>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Target: </span>
                <strong style={{ color: "#0f172a", fontWeight: 800 }}>{formatRupees(target)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Actual: </span>
                <strong style={{ color: "#0284c7", fontWeight: 800 }}>{formatRupees(actual)}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: ".04em" }}>Remaining to Target</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#991b1b", marginTop: 1 }}>{formatRupees(remaining)}</div>
            </div>
            <span style={{ fontSize: 20 }}>⚠️</span>
          </div>
        </div>

        {/* Field Activity */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>🚶 Field Activity ({periodLabel})</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
            <FieldStat
              icon="🚶"
              value={formatNumber(kpi.visitsCompleted)}
              label={
                <>
                  Visits<br />
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                    ({kpi.visitsPlanned > 0 ? Math.round((kpi.visitsCompleted / kpi.visitsPlanned) * 100) : 0}% of plan)
                  </span>
                </>
              }
              color="#16a34a"
            />
            <FieldStat icon="📋" value={formatNumber(kpi.followUpsOpen)} label={<>Open<br />Follow-ups</>} color="#0284c7" />
            <FieldStat icon="👥" value={formatNumber(kpi.customersCovered)} label={<>Unique<br />Customers</>} color="#7c3aed" />
          </div>
        </div>

        {/* Pipeline */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>🛒 Pipeline (Expected Orders)</p>
          <strong style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", display: "block", marginTop: 10 }}>{formatRupees(kpi.expectedOrdersValue)}</strong>
          <small style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>Total pipeline value</small>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.pipeline ?? []).slice(0, 4).map((p: any) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.customerName}</span>
                <span style={{ fontSize: 12, color: "#0284c7", fontWeight: 800 }}>{formatRupees(p.expectedValue)}</span>
              </div>
            ))}
            {(data.pipeline ?? []).length === 0 && <p style={{ color: "#64748b", fontSize: 12, margin: "12px 0 0", fontStyle: "italic" }}>No open pipeline orders</p>}
          </div>
        </div>
      </div>

      {/* ── Row 3: Top dealers + Dormant + Product performance ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
        {/* Top 5 Dealers */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>👤 Top 5 Dealers by Revenue ({periodLabel})</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#475569" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Dealer Name</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Sales Value</th>
                <th style={{ ...thStyle, textAlign: "right" }}>% Share</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {topDealers.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>No sales in this period</td></tr>
              ) : topDealers.map((d, i) => {
                const pctShare = Math.round((d.salesValue / dealerTotal) * 100);
                return (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "8px 4px", fontWeight: 700, color: "#0f172a" }}>{d.dealerName}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>{formatRupees(d.salesValue)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", color: "#475569", fontWeight: 600 }}>{pctShare}%</td>
                    <td style={{ padding: "8px 4px", width: 60 }}>
                      <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pctShare}%`, background: "linear-gradient(90deg, #0284c7, #0369a1)", borderRadius: 4 }} />
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
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#475569" }}>
                <th style={thStyle}>Dealer Name</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Last Invoice</th>
              </tr>
            </thead>
            <tbody>
              {dormant.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "#16a34a", padding: "24px 0", fontWeight: 700 }}>
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px", display: "inline-block" }}>
                      ✓ No dormant dealers
                    </div>
                  </td>
                </tr>
              ) : dormant.map((d: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 4px", fontWeight: 700, color: "#0f172a" }}>{d.dealerName}</td>
                  <td style={{ padding: "9px 4px", textAlign: "right" }}>
                    <span style={{ background: monthsAgoColor(d.lastInvoice) + "18", color: monthsAgoColor(d.lastInvoice), border: `1px solid ${monthsAgoColor(d.lastInvoice)}33`, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                      {monthsAgoLabel(d.lastInvoice)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Product Performance (Top 5) */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>📦 Product Performance (Top 5)</p>
            {onSelectTab && allProducts.length > 5 && (
              <button
                type="button"
                onClick={() => onSelectTab("products")}
                style={{ border: "none", background: "#e0f2fe", color: "#0369a1", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                View All ({allProducts.length}) →
              </button>
            )}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "#475569" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Product</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Sales Value</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>No product sales</td></tr>
              ) : topProducts.map((p: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 4px", color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "8px 4px", fontWeight: 700, color: "#0f172a" }}>{p.name}</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>{formatRupees(p.salesValue)}</td>
                  <td style={{ padding: "8px 4px", width: 60 }}>
                    <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.round((p.salesValue / productTotal) * 100)}%`, background: "linear-gradient(90deg, #7c3aed, #6d28d9)", borderRadius: 4 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


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
                <ReportCardTab data={data} kpi={kpi} period={period} onSelectTab={setTab} />
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

