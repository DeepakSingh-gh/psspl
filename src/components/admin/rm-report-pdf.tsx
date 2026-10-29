"use client";

import React from "react";
import { RmPerformancePdfDocument, RmPerformancePdfPreview } from "@/components/reports/rm-performance-pdf";
import type { RmPerformanceReport } from "../../../shared/rm-performance.mjs";
import "@/components/reports/rm-performance.css";
import { TechnicalServiceDetails } from "@/components/reports/technical-service-details";
import { ExecutiveTerritoryCoverage } from "@/components/reports/executive-territory-coverage";
import { formatDate, formatDateTime } from "@/lib/format";
import { rmDetailedInsights, rmManagementBriefs } from "@/lib/rm-management-brief";

/* ─────────────────────────────────────────────────────────────
   Formatters
───────────────────────────────────────────────────────────── */
function fmt(val: number) {
  if (!val || isNaN(val)) return "₹0";
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)} K`;
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
}

const fmtDate = formatDate;

/* ─────────────────────────────────────────────────────────────
   Report Component for Direct PDF Generation
   Strict 2-Page Executive Layout (A4: 794px × 1123px per page)
───────────────────────────────────────────────────────────── */
export function RmReportDocument({ data, period }: { data: any; period?: string }) {
  if (data?.version === 2) return <RmPerformancePdfDocument report={data as RmPerformanceReport} />;
  if (!data) return null;

  const kpi = data.kpi ?? {};
  const target = kpi.targetValue ?? 0;
  const actual = kpi.actualSalesValue ?? 0;
  const hasActual = kpi.actualSalesValue != null;
  const hasTarget = kpi.targetValue != null;
  const pct = kpi.achievementPercent ?? 0;
  const hasPct = kpi.achievementPercent != null;
  const gap = hasTarget && hasActual ? target - actual : null;
  const statusLabel = !hasPct ? "Target data unavailable" : pct >= 100 ? "Target exceeded" : pct >= 80 ? "On track" : pct >= 50 ? "Moderate pace" : "Needs attention";
  const statusColor = !hasPct ? "#0369a1" : pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  const statusBg = !hasPct ? "#e0f2fe" : pct >= 80 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2";
  const demoCustomers = Boolean(data.demoSections?.dealers);
  const demoProducts = Boolean(data.demoSections?.products);
  const topCustomers: Array<[string, number]> = (data.topDealers ?? []).slice(0, 5).map((dealer: any) => [dealer.dealerName, dealer.salesValue]);
  const totalSales = actual || 1;
  const topProducts = (data.topProducts ?? []).slice(0, 5);
  const productTotal = topProducts.reduce((s: number, p: any) => s + p.salesValue, 0) || 1;
  const recentVisits = (data.customerVisits ?? []).slice(0, 4);
  const thrust = data.thrustProducts;
  const thrustProducts: Array<{ id: string; name: string; ytdSalesRupees: number | null; isDemo?: boolean }> = thrust?.products ?? [];
  const openFollowUps = (data.followUps ?? []).filter((f: any) => !f.completedAt).slice(0, 4);
  const periodLabel = data.reportLabel ?? ((data.reportSource
    ? `${period === "fytd" ? "FYTD" : "Reported month"} · PDF as of ${formatDate(data.reportSource.asOf)}`
    : `${period === "today" ? "Today" : period === "week" ? "This Week" : period === "fytd" ? "FYTD" : "This Month"} · ${data.from ? formatDate(data.from) : ""}${data.from && data.to && data.from !== data.to ? ` to ${formatDate(data.to)}` : ""}`) + (data.livePreviewDemo ? " · Demo preview" : ""));
  const generatedAt = formatDateTime(new Date().toISOString());
  const source = data.insightSource ?? data;
  const briefs = rmManagementBriefs(source);
  const detailedItems = rmDetailedInsights(source, period);
  const totalPages = 2;
  const isUnder = hasPct && pct < (data.reportingThresholds?.targetAlertPercent ?? 80);
  const topActions = briefs.slice(0, 3).map((item: any) => ({
    urgency: item.severity === "high" ? "DO THIS FIRST" : "CHECK THIS",
    title: item.title,
    detail: item.finding,
    actions: item.actions as string[],
    color: item.severity === "high" ? "#dc2626" : "#d97706",
  }));

  const isShortPeriod = period !== "fytd";
  const monthlyCandidates: Array<{ month: string; label: string; target: number | null; actual: number | null; achievementPercent: number | null }> = isShortPeriod
    ? data.periodChartRows ?? [{ month: data.to ?? period, label: period === "today" ? "Today" : "This Week", target: hasTarget ? target : null, actual: hasActual ? actual : null, achievementPercent: hasPct ? pct : null }]
    : data.monthlyTargetVsActual ?? [];
  const monthlyRows = monthlyCandidates.length ? monthlyCandidates : [{month:"empty",label:"Selected period",target:null,actual:null,achievementPercent:null}];
  const hasChartValues = monthlyRows.some(row => (row.actual ?? 0) !== 0 || (row.target ?? 0) > 0);
  const chartW = 730;
  const chartH = 92;
  const cLeft = 46;
  const cRight = 14;
  const cTop = 14;
  const cBottom = 20;
  const plotW = chartW - cLeft - cRight;
  const plotH = chartH - cTop - cBottom;
  const maxVal = hasChartValues ? monthlyRows.reduce((m, r) => Math.max(m, Math.abs(r.target || 0), Math.abs(r.actual || 0)), 1) : 100000;
  const magnitude = 10 ** Math.floor(Math.log10(maxVal));
  const ceiling = Math.ceil(maxVal * 1.15 / magnitude) * magnitude;
  const floor = Math.min(0, ...monthlyRows.map(row => row.actual ?? 0)) * 1.15;
  const chartY = (value: number) => chartH - cBottom - (value - floor) / (ceiling - floor) * plotH;
  const stepX = monthlyRows.length > 0 ? plotW / monthlyRows.length : plotW;
  const barW = Math.max(6, Math.min(18, (stepX - 8) / 2));

  return (
    <div
      id="rm-report-render-target"
      style={{
        width: "794px",
        backgroundColor: "#ffffff",
        color: "#1e293b",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
        fontSize: "11px",
        lineHeight: 1.4,
      }}
    >
      {/* ══════════════════════════════════════════════════════════════
         PAGE 1: EXECUTIVE SUMMARY & PERFORMANCE OVERVIEW (Exact A4 1122px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        id="rm-report-page-1"
        data-rm-report-page
        className="pdf-page-1"
        style={{
          width: "794px",
          height: "1122px",
          maxHeight: "1122px",
          padding: "24px 28px 20px",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
        }}
      >
        <div>
          {/* ── HEADER / COVER BLOCK ── */}
          <div
            style={{
              background: "linear-gradient(135deg, #0c2040 0%, #003a5c 55%, #007cba 100%)",
              borderRadius: "14px",
              padding: "20px 24px",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "14px",
              boxShadow: "0 4px 16px rgba(0,40,80,0.18)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "8.5px",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.72)",
                  marginBottom: "6px",
                }}
              >
                PROGRESSIVE SURFACE SYSTEMS · RM PERFORMANCE REPORT
              </div>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  margin: "0 0 8px",
                  color: "#ffffff",
                }}
              >
                {data.name}
              </h1>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                {data.rmCode && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    RM {data.rmCode}
                  </span>
                )}
                {data.region && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 600,
                    }}
                  >
                    📍 {data.region}
                  </span>
                )}
                {data.operatingFrom && (
                  <span
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 600,
                    }}
                  >
                    🏢 {data.operatingFrom}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                📅 Report Cycle: <strong>{periodLabel}</strong> ({new Date(`${data.reportSource?.asOf ?? data.to}T12:00:00Z`).toLocaleString("en-IN", { month: "long", year: "numeric" })})
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "12px",
                padding: "12px 18px",
                textAlign: "center",
                minWidth: "140px",
              }}
            >
              <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                ACHIEVEMENT
              </div>
              <div style={{ fontSize: "32px", fontWeight: 900, lineHeight: 1.1, margin: "3px 0", color: "#ffffff" }}>
                {hasPct ? `${Math.round(pct)}%` : "Data unavailable"}
              </div>
              <div
                style={{
                  background: statusBg,
                  color: statusColor,
                  borderRadius: "99px",
                  padding: "2px 10px",
                  fontSize: "10px",
                  fontWeight: 800,
                  display: "inline-block",
                }}
              >
                {statusLabel}
              </div>
              <div style={{ fontSize: "8.5px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>
                Generated {generatedAt}
              </div>
            </div>
          </div>

          {data.technicalService && <div style={{ marginBottom: 12 }}><TechnicalServiceDetails service={data.technicalService} compact /></div>}

          {/* ── AI SALES INSIGHT BLOCK ── */}
          <div
            style={{
              background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
              border: "1.5px solid #bfdbfe",
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🤖</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#1e3a8a" }}>
                    AI Insights
                  </h3>
                  <div style={{ fontSize: "9px", color: "#3b82f6" }}>
                    How sales and customer visits are going
                  </div>
                </div>
              </div>
              <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "99px", fontSize: "9px", fontWeight: 700 }}>
                {data.livePreviewDemo ? "Demo preview" : "Report analysis"}
              </span>
            </div>

            <ol className="pdf-ai-points" style={{ margin: 0, paddingLeft: "16px", color: "#334155" }}>
              {detailedItems.slice(0, 2).map(item => <li key={item.id} style={{ marginBottom: "7px", paddingLeft: "2px", fontSize: "9px", lineHeight: 1.5 }}>
                <strong style={{ color: "#003a5c", fontSize: "10px" }}>{item.title}</strong>
                <ul style={{ margin: "3px 0 0", paddingLeft: "13px" }}>
                  {item.points.map((point, index) => <li key={index} style={{ marginBottom: "2px" }}>{point}</li>)}
                </ul>
              </li>)}
            </ol>
            {!detailedItems.length && <div style={{ fontSize: "10px", color: "#64748b" }}>There is not enough data to explain sales yet.</div>}
          </div>

          {/* ── MANAGER ACTION PLAN BLOCK ── */}
          <div
            style={{
              background: isUnder ? "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)" : "linear-gradient(135deg, #f0fdf4 0%, #f0fdfa 100%)",
              border: `1.5px solid ${isUnder ? "#f87171" : "#86efac"}`,
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: isUnder ? "#991b1b" : "#166534" }}>
                  Next steps
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                  Manager Action Plan — {data.name}
                </h3>
              </div>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "24px",
                  fontWeight: 800,
                  fontSize: "10.5px",
                  background: isUnder ? "#dc2626" : "#16a34a",
                  color: "#ffffff",
                }}
              >
                {!hasPct ? "Numbers not available" : isUnder ? "Needs a closer look" : topActions.length ? "Check these points" : "No issues found"}
              </span>
            </div>

            {/* Action Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {topActions.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <strong style={{ fontSize: "11px", color: "#0f172a" }}>{item.title}</strong>
                    <span
                      style={{
                        fontSize: "8.5px",
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: item.color === "#dc2626" ? "#fee2e2" : item.color === "#d97706" ? "#fef3c7" : "#dcfce7",
                        color: item.color,
                      }}
                    >
                      {item.urgency}
                    </span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "4px" }}>
                    {item.detail}
                  </div>
                  <div
                    style={{
                      background: "#f8fafc",
                      borderLeft: `3px solid ${item.color}`,
                      padding: "4px 8px",
                      borderRadius: "0 4px 4px 0",
                      fontSize: "9.5px",
                      color: "#334155",
                    }}
                  >
                    <ul style={{ margin: 0, paddingLeft: "13px" }}>{item.actions.map((action: string) => <li key={action}>{action}</li>)}</ul>
                  </div>
                </div>
              ))}
              {topActions.length === 0 && <div style={{ fontSize: 10, color: "#64748b" }}>No configured alerts were triggered. This does not certify that performance is problem-free.</div>}
            </div>
          </div>

          {/* ── KPI GRID (8 Metrics) ── */}
          <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#003a5c", marginBottom: "6px" }}>
            Key Performance Indicators
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "Target Quota", val: hasTarget ? fmt(target) : "Data unavailable", icon: "🎯", bg: "#dbeafe", sub: "Period quota", col: "#0f172a" },
              { label: "Actual Sales", val: hasActual ? fmt(actual) : "Data unavailable", icon: "💰", bg: "#dcfce7", sub: data.financialSource ? "Supplied report" : "Billed in Tally", col: "#16a34a" },
              { label: "Gap to Target", val: gap == null ? "Data unavailable" : gap > 0 ? fmt(gap) : `+${fmt(Math.abs(gap))}`, icon: "📉", bg: "#fef3c7", sub: "Target difference", col: "#d97706" },
              { label: "Achievement %", val: hasPct ? `${Math.round(pct)}%` : "Data unavailable", icon: "⚡", bg: "#f1f5f9", sub: "Quota ratio", col: statusColor },
              { label: "Active Dealers", val: data.activeDealerCount ?? "Data unavailable", icon: "🤝", bg: "#ede9fe", sub: demoCustomers ? "Demo accounts" : "Billed accounts", col: "#0f172a" },
              { label: "Customer Visits", val: kpi.visitsCompleted ?? recentVisits.length, icon: "🏪", bg: "#fce7f3", sub: "Visits logged", col: "#0f172a" },
              { label: "Open Follow-ups", val: kpi.followUpsOpen ?? openFollowUps.length, icon: "📋", bg: openFollowUps.length > 0 ? "#fee2e2" : "#dcfce7", sub: data.demoSections?.followups ? "Demo follow-ups" : "Pending action", col: openFollowUps.length > 0 ? "#dc2626" : "#16a34a" },
              { label: "Products Sold", val: kpi.productsSold ?? topProducts.length, icon: "📦", bg: "#dcfce7", sub: demoProducts ? "Demo products" : "Distinct products", col: "#0f172a" },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "9px",
                  padding: "8px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b" }}>{c.label}</span>
                  <span style={{ background: c.bg, borderRadius: "5px", width: "18px", height: "18px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>{c.icon}</span>
                </div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: c.col, lineHeight: 1.2 }}>{c.val}</div>
                <div style={{ fontSize: "8.5px", color: "#94a3b8", marginTop: "1px" }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Sales target versus actual for the selected reporting period ── */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "9px",
              padding: "9px 12px",
              marginBottom: "10px",
            }}
          >
            {/* Header + Legend */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px" }}>📈</span>
                <strong style={{ fontSize: "10.5px", color: "#0f172a" }}>{data.selectedPeriod?.label ?? "Selected period"} Sales vs Target</strong>
                <span style={{ fontSize: "9px", color: "#64748b" }}>{data.chartGranularity === "weekly" || data.chartGranularity === "source-week" ? "Supplied weekly totals" : period === "fytd" || data.chartGranularity === "monthly" ? "Monthly totals" : "Daily totals"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "9px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#cbd5e1", display: "inline-block" }} />
                  <span style={{ color: "#64748b" }}>Target</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#16a34a", display: "inline-block" }} />
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>Achieved (≥100%)</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#0284c7", display: "inline-block" }} />
                  <span style={{ color: "#0284c7", fontWeight: 700 }}>Achieved (&lt;100%)</span>
                </span>
              </div>
            </div>

            {data.chartNote && <p style={{fontSize:8,color:"#64748b",margin:"0 0 5px"}}>{data.chartNote}</p>}
            {!hasChartValues && <p style={{fontSize:9,color:"#64748b",margin:"0 0 5px"}}>No Data Available</p>}
            {/* SVG Visual Graph */}
            {monthlyRows.length > 0 ? (
              <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: "94px", display: "block" }}>
                {/* Horizontal reference grid lines */}
                {[0, 0.5, 1].map((ratio) => {
                  const val = floor + (ceiling - floor) * ratio;
                  const yPos = chartY(val);
                  return (
                    <g key={ratio}>
                      <line
                        x1={cLeft}
                        x2={chartW - cRight}
                        y1={yPos}
                        y2={yPos}
                        stroke="#e2e8f0"
                        strokeDasharray={ratio === 0 ? "none" : "2 2"}
                        strokeWidth={ratio === 0 ? 1 : 0.8}
                      />
                      <text x={cLeft - 5} y={yPos + 3} textAnchor="end" fontSize="7.5" fill="#94a3b8" fontWeight="600">
                        {fmt(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Bars for the selected period */}
                {monthlyRows.map((row, idx) => {
                  const groupX = cLeft + idx * stepX + stepX / 2;
                  const targetX = groupX - barW - 1;
                  const actualX = groupX + 1;

                  const targetH = Math.abs(chartY(0) - chartY(row.target ?? 0));
                  const targetY = Math.min(chartY(0), chartY(row.target ?? 0));

                  const actualH = Math.abs(chartY(0) - chartY(row.actual ?? 0));
                  const actualY = Math.min(chartY(0), chartY(row.actual ?? 0));

                  const isMet = row.achievementPercent != null && row.achievementPercent >= 100;
                  const actualColor = isMet ? "#16a34a" : "#0284c7";

                  return (
                    <g key={row.month || idx}>
                      {/* Target bar */}
                      {row.target != null && <rect
                        x={targetX}
                        y={targetY}
                        width={barW}
                        height={targetH}
                        rx="2"
                        fill="#cbd5e1"
                      />}

                      {/* Actual bar */}
                      {row.actual != null && <rect
                        x={actualX}
                        y={actualY}
                        width={barW}
                        height={actualH}
                        rx="2"
                        fill={actualColor}
                      />}

                      {/* % text above actual bar for active billing */}
                      {monthlyRows.length <= 12 && (row.actual ?? 0) > 0 && row.achievementPercent != null && (
                        <text
                          x={actualX + barW / 2}
                          y={actualY - 3}
                          textAnchor="middle"
                          fontSize="7"
                          fontWeight="800"
                          fill={actualColor}
                        >
                      {row.achievementPercent}%
                        </text>
                      )}

                      {/* Period label at bottom */}
                      <text
                        x={groupX}
                        y={chartH - 4}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="600"
                        fill="#64748b"
                      >
                        {idx % Math.ceil(monthlyRows.length / 12) === 0 || idx === monthlyRows.length - 1 ? row.label : ""}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              /* Fallback if no monthly rows */
              <div>
                <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden", marginBottom: "6px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, pct))}%`,
                      background: pct >= 80 ? "linear-gradient(90deg, #16a34a, #22c55e)" : pct >= 50 ? "linear-gradient(90deg, #d97706, #f59e0b)" : "linear-gradient(90deg, #dc2626, #ef4444)",
                      borderRadius: "99px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "#64748b" }}>
                  <span>Target: <strong>{hasTarget ? fmt(target) : "Data unavailable"}</strong></span>
                  <span>Achieved: <strong style={{ color: "#16a34a" }}>{hasActual ? fmt(actual) : "Data unavailable"}</strong></span>
                  <span>Gap: <strong style={{ color: gap == null ? "#64748b" : gap > 0 ? "#dc2626" : "#16a34a" }}>{gap == null ? "Data unavailable" : gap > 0 ? fmt(gap) : `+${fmt(Math.abs(gap))}`}</strong></span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── PAGE 1 FOOTER ── */}
        <div
          style={{
            borderTop: "1.5px solid #e2e8f0",
            paddingTop: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "9px",
            color: "#94a3b8",
          }}
        >
          <div style={{ fontWeight: 600, color: "#475569" }}>
            Progressive Surface Systems · RM Report Card · <strong>{data.name}</strong>
          </div>
          <div>Page 1 of {totalPages} · Confidential · Generated {generatedAt}</div>
        </div>
      </div>

      {/* ── Visual separator between Page 1 and Page 2 in preview ── */}
      <div style={{ height: "24px", backgroundColor: "#1e293b" }} />

      {/* ══════════════════════════════════════════════════════════════
         PAGE 2: PERFORMANCE DETAILS & FIELD ACTIVITY (Exact A4 1122px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        id="rm-report-page-2"
        data-rm-report-page
        className="pdf-page-2"
        style={{
          width: "794px",
          height: "1122px",
          maxHeight: "1122px",
          padding: "24px 28px 20px",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ width: "100%" }}>
          {/* ── PAGE 2 HEADER BAR ── */}
          <div
            style={{
              background: "linear-gradient(135deg, #0c2040 0%, #003a5c 100%)",
              borderRadius: "10px",
              padding: "10px 18px",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginRight: "16px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "7px", background: "rgba(56,189,248,0.18)", color: "#7dd3fc", fontSize: "10px", fontWeight: 800 }}>02</span>
              <strong style={{ fontSize: "15px", color: "#ffffff", letterSpacing: "0.01em" }}>Performance Details</strong>
            </div>
            <div style={{ textAlign: "right", fontSize: "9.5px", color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              <strong style={{ color: "#ffffff" }}>{data.name}</strong><br />
              RM Code: <strong>{data.rmCode || "Unavailable"}</strong> · {periodLabel}
            </div>
          </div>

          {data.executiveTerritoryCoverage?.entries?.length > 0 && <div style={{ marginBottom: 10 }}><ExecutiveTerritoryCoverage coverage={data.executiveTerritoryCoverage} compact /></div>}
          {thrustProducts.length > 0 && (
            <section aria-label="Strategic Thrust Products" className="pdf-thrust-products" style={{ border: "1px solid #bae6fd", background: "#f0f9ff", borderRadius: "9px", padding: "10px 12px", marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "11px", color: "#003a5c" }}>Strategic Thrust Products ({thrustProducts.length})</h3>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>Strategic Focus {thrust.financialYear ?? ""}{data.reportSource?.asOf ? ` | As of ${formatDate(data.reportSource.asOf)}` : " | Selected reporting period"}</div>
                </div>
                <div style={{ textAlign: "right", color: "#854d0e", background: "#fef9c3", borderRadius: "6px", padding: "5px 8px", flexShrink: 0 }}>
                  <div style={{ fontSize: "8px", fontWeight: 700 }}>TOTAL THRUST SALES</div>
                  <strong style={{ fontSize: "13px" }}>{thrust.totalSalesRupees == null ? "Not provided" : fmt(thrust.totalSalesRupees)}</strong>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "5px" }}>
                {thrustProducts.map((product, index) => (
                  <div key={product.id ?? product.name} className="pdf-thrust-product" style={{ background: "#ffffff", border: "1px solid #e0f2fe", borderRadius: "5px", padding: "5px 7px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#0f172a", overflowWrap: "anywhere" }}>{index + 1}. {product.name}</div>
                    <div style={{ fontSize: "8px", color: product.isDemo ? "#92400e" : product.ytdSalesRupees == null ? "#64748b" : "#15803d", marginTop: "2px" }}>{product.ytdSalesRupees == null ? "Sales not provided by source" : `${fmt(product.ytdSalesRupees)}${product.isDemo ? " | Demo sales" : ""}`}</div>
                  </div>
                ))}
              </div>
              {thrust.hasDemoProducts && <p style={{ margin: "6px 0 0", fontSize: 8, color: "#92400e" }}>Demo product sales are not included in the reported total above.</p>}
            </section>
          )}

          {/* ── TWO COLUMN: TOP CUSTOMERS & TOP PRODUCTS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            {/* Top Customers */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                🤝 Top Customers ({topCustomers.length}){demoCustomers ? " · Demo" : ""}
              </div>
              {topCustomers.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #f1f5f9", color: "#64748b", fontSize: "9px", textAlign: "left" }}>
                      <th style={{ padding: "3px 0", width: "16px" }}>#</th>
                      <th style={{ padding: "3px 4px" }}>Customer</th>
                      <th style={{ padding: "3px 4px", textAlign: "right" }}>Sales</th>
                      <th style={{ padding: "3px 0", textAlign: "right" }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map(([cName, cVal], idx) => {
                      const share = Math.round((cVal / totalSales) * 100);
                      return (
                        <tr key={cName} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "3px 0", color: "#94a3b8" }}>{idx + 1}</td>
                          <td style={{ padding: "3px 4px", fontWeight: 600, color: "#1e293b", maxWidth: "155px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {cName}
                          </td>
                          <td style={{ padding: "3px 4px", textAlign: "right", color: "#16a34a", fontWeight: 700 }}>
                            {fmt(cVal)}
                          </td>
                          <td style={{ padding: "3px 0", textAlign: "right", color: "#64748b" }}>
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "14px 0", fontSize: "10px" }}>No Data Available</div>
              )}
            </div>

            {/* Top Products */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                📦 Top Products ({topProducts.length}){demoProducts ? " · Demo" : ""}
              </div>
              {topProducts.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #f1f5f9", color: "#64748b", fontSize: "9px", textAlign: "left" }}>
                      <th style={{ padding: "3px 0", width: "16px" }}>#</th>
                      <th style={{ padding: "3px 4px" }}>Product</th>
                      <th style={{ padding: "3px 4px", textAlign: "right" }}>Sales</th>
                      <th style={{ padding: "3px 0", textAlign: "right" }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p: any, idx: number) => {
                      const share = Math.round((p.salesValue / productTotal) * 100);
                      return (
                        <tr key={p.name || idx} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "3px 0", color: "#94a3b8" }}>{idx + 1}</td>
                          <td style={{ padding: "3px 4px", fontWeight: 600, color: "#1e293b", maxWidth: "155px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </td>
                          <td style={{ padding: "3px 4px", textAlign: "right", color: "#16a34a", fontWeight: 700 }}>
                            {fmt(p.salesValue)}
                          </td>
                          <td style={{ padding: "3px 0", textAlign: "right", color: "#64748b" }}>
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "14px 0", fontSize: "10px" }}>No Data Available</div>
              )}
            </div>
          </div>

          {/* ── TWO COLUMN: FIELD VISITS & OPEN FOLLOW-UPS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* Customer Visits */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                🏪 Recent Field Visits ({recentVisits.length}){data.livePreviewDemo ? " · Demo" : ""}
              </div>
              {recentVisits.length > 0 ? (
                <div>
                  {recentVisits.map((v: any) => (
                    <div key={v.id} style={{ background: "#f8fafc", border: "1px solid #e8eef5", borderRadius: "6px", padding: "5px 8px", marginBottom: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1px" }}>
                        <span style={{ fontWeight: 700, fontSize: "10px", color: "#0f172a" }}>{v.customerName}</span>
                        <span style={{ fontSize: "8.5px", color: "#94a3b8" }}>{fmtDate(v.date)}</span>
                      </div>
                      <div style={{ fontSize: "9.5px", color: v.outcome ? "#475569" : "#94a3b8", fontStyle: v.outcome ? "normal" : "italic" }}>
                        {v.outcome || v.purpose || "No outcome recorded"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "12px 0", fontSize: "10px" }}>No Data Available</div>
              )}
            </div>

            {/* Follow-ups */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                📋 Open Follow-ups ({openFollowUps.length}){data.demoSections?.followups ? " | Demo" : ""}
              </div>
              {openFollowUps.length > 0 ? (
                <div>
                  {openFollowUps.map((f: any) => (
                    <div key={f.id} style={{ background: "#f8fafc", border: "1px solid #e8eef5", borderRadius: "6px", padding: "5px 8px", marginBottom: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1px" }}>
                        <span style={{ fontWeight: 700, fontSize: "10px", color: "#0f172a" }}>{f.title}</span>
                        <span style={{ fontSize: "8.5px", background: f.priority === "high" ? "#fee2e2" : "#fef3c7", color: f.priority === "high" ? "#dc2626" : "#b45309", padding: "1px 5px", borderRadius: "99px", fontWeight: 700 }}>
                          {f.priority || "Normal"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#64748b" }}>
                        <span>{f.customerName || "—"}</span>
                        <span>Due: {fmtDate(f.dueDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#16a34a", padding: "12px 0", fontSize: "10px", fontWeight: 600 }}>
                  No Data Available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── PAGE 2 FOOTER ── */}
        <div
          style={{
            borderTop: "1.5px solid #e2e8f0",
            paddingTop: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "9px",
            color: "#94a3b8",
          }}
        >
          <div style={{ fontWeight: 600, color: "#475569" }}>
            Progressive Surface Systems · Supervisory Directives · <strong>{data.name}</strong>
          </div>
          <div>Page 2 of {totalPages} · End of report</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PDF Downloader: capture every report page
───────────────────────────────────────────────────────────── */
export async function downloadRmReportDirect(data: any, period?: string): Promise<boolean> {
  if (!data) return false;
  if (data.version === 2 && document.querySelector('#rm-report-render-target')?.getAttribute('data-pagination-ready') !== 'true') return false;

  const pageElements = Array.from(document.querySelectorAll<HTMLElement>("#rm-report-render-target [data-rm-report-page]"));
  if (!pageElements.length) return false;
  const cleanName = (data.name || "RM").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${cleanName}_RM_Report_${data.selectedPeriod?.reportType ?? period ?? "month"}_${data.from ? `${formatDate(data.from)}_to_` : ""}${formatDate(data.to ?? new Date().toISOString())}.pdf`;
  try {
    await document.fonts.ready;
    const { jsPDF } = await import("jspdf");
    const html2canvasModule = await import("html2canvas");
    const html2canvas = (html2canvasModule as any).default || html2canvasModule;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    for (const [index, element] of pageElements.entries()) {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", scrollY: 0 });
      if (index > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    pdf.save(fileName);
    return true;
  } catch (err) {
    console.error("Report PDF generation failed:", err);
    return false;
  }
}


/* ─────────────────────────────────────────────────────────────
   In-Page Report Preview Modal (NO NEXT PAGE OPENS!)
───────────────────────────────────────────────────────────── */
export function RmReportPreviewModal(props: { isOpen: boolean; onClose: () => void; data: any; period?: string }) {
  if (!props.isOpen || !props.data) return null;
  if (props.data.version === 2) return <RmPerformancePdfPreview report={props.data as RmPerformanceReport} onClose={props.onClose} onDownload={() => downloadRmReportDirect(props.data, props.period)} />;
  return <LegacyRmReportPreviewModal {...props} />;
}

function LegacyRmReportPreviewModal({
  isOpen,
  onClose,
  data,
  period,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  period?: string;
}) {
  const [downloading, setDownloading] = React.useState(false);
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const ok = await downloadRmReportDirect(data, period);
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      } else {
        setDownloadError("PDF could not be generated. Please try Download PDF again.");
      }
    } catch (e) {
      console.error(e);
      setDownloadError("PDF could not be generated. Please try Download PDF again.");
    } finally {
      setDownloading(false);
    }
  };

  const periodLabel = data.reportLabel ?? (
    period === "today" ? "Today" :
    period === "week"  ? "This Week" :
    period === "fytd"  ? "FYTD" :
    "This Month");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* ── Top Header Toolbar ── */}
      <div
        style={{
          height: "60px",
          background: "linear-gradient(135deg, #0c2040 0%, #003a5c 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.14)",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 10px #4ade80",
            }}
          />
          <div>
            <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📄 Report Preview — {data.name}</span>
              <span
                style={{
                  background: "rgba(255,255,255,0.18)",
                  borderRadius: "99px",
                  padding: "1px 8px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                2 Pages A4
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)" }}>
              {periodLabel} · Ready for direct PDF download · No next page will open
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Download PDF button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 18px",
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: downloading ? "not-allowed" : "pointer",
              boxShadow: "0 2px 10px rgba(22,163,74,0.45)",
              transition: "all 0.15s ease",
            }}
          >
            {downloading ? (
              <>
                <span className="rm-btn-spinner" />
                Generating PDF…
              </>
            ) : downloadSuccess ? (
              <>
                ✓ Downloaded!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </>
            )}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.12)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {downloadError && <p role="alert" style={{ margin: 0, padding: "10px 24px", background: "#fff1f2", color: "#be123c" }}>{downloadError}</p>}
      {/* ── Scrollable Document Preview Area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 16px 48px",
          background: "#1e293b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            width: "100%",
            maxWidth: "840px",
          }}
        >
          {/* Document container */}
          <div
            style={{
              boxShadow: "0 16px 50px rgba(0,0,0,0.5)",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <RmReportDocument data={data} period={period} />
          </div>

          <div style={{ color: "#64748b", fontSize: "11px", fontWeight: 600, textAlign: "center", padding: "8px 0" }}>
            End of Full Report · Click <strong>Download PDF</strong> above to save
          </div>
        </div>
      </div>
    </div>
  );
}
