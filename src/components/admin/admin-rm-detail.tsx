"use client";
import { useEffect, useId, useRef, useState } from "react";
import { raisKhanReportPresentation } from "@/lib/rais-khan-period-preview";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { RmReportPreviewModal } from "./rm-report-pdf";
import { RmPerformanceWorkspace } from "./rm-performance-workspace";
import { adminApi, rmApi } from "@/lib/api";
import { RmPeriodFilters } from "@/components/reports/rm-period-filters";
import { rmReportPeriod, type RmReportSelection } from "../../../shared/rm-report-period.mjs";
import { indiaBusinessDate } from "@/lib/business-date";
import { useAdminData } from "@/lib/use-admin-data";
import { achievementPercent } from "../../../shared/achievement.mjs";
import { rmDetailedInsights, rmManagementBriefs } from "@/lib/rm-management-brief";
import { TechnicalServiceDetails } from "@/components/reports/technical-service-details";
import { ExecutiveTerritoryCoverage } from "@/components/reports/executive-territory-coverage";
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
  | "insight"
  | "actionplan";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "actionplan", label: "📋 Manager Action Plan" },
  { id: "insight", label: "AI Insights" },
  { id: "performance", label: "📊 Report Card" },
  { id: "visits", label: "Customer Visits" },
  { id: "pipeline", label: "Pipeline" },
  { id: "sales", label: "Actual Sales" },
  { id: "products", label: "Products" },
  { id: "followups", label: "Follow-ups" },
];

type Period = "today" | "week" | "month" | "fytd";

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

/* ── Target vs Actual Chart ── */
function TargetVsActualChart({ rows: providedRows, sourceDate, annualPerformance, demo, period, note, granularity }: { rows?: Array<{ month: string; label: string; target: number | null; actual: number | null; achievementPercent: number | null }>; sourceDate?: string; annualPerformance?: { actual: number | null; target: number | null; achievementPercent: number | null }; demo?: boolean; period: Period; note?: string; granularity?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const isShortPeriod = period !== "fytd";
  const periodName = period === "today" ? "Today" : period === "week" ? "Weekly" : period === "fytd" ? "Yearly" : "Monthly";

  const rows = providedRows?.length ? providedRows : [{ month: "empty", label: "Selected period", target: null, actual: null, achievementPercent: null }];
  const hasChartValues = rows.some(row => (row.actual ?? 0) !== 0 || (row.target ?? 0) > 0);

  const highestActual = Math.max(...rows.map((r) => r.actual ?? 0), 1);
  const highestTarget = Math.max(...rows.map((r) => r.target ?? 0), 1);
  const ceiling = hasChartValues ? Math.max(highestActual, highestTarget) * 1.15 : 100000;
  const hasActualData = annualPerformance ? annualPerformance.actual != null : rows.some(row => row.actual != null);

  const totalActual = annualPerformance?.actual != null ? annualPerformance.actual : rows.reduce((s, r) => s + (r.actual ?? 0), 0);
  const totalTarget = rows.reduce((s, r) => s + (r.target ?? 0), 0);
  const avgAchievement = annualPerformance ? annualPerformance.achievementPercent : rows.some(row => row.actual != null) ? achievementPercent(totalActual, totalTarget) : null;
  const bestMonth = rows.filter(row => row.actual != null && row.actual !== 0).reduce<(typeof rows)[number] | null>((best, row) => !best || (row.actual ?? 0) > (best.actual ?? 0) ? row : best, null);

  const chartHeight = 230;
  const chartWidth = Math.max(760, rows.length * 64 + 80);
  const left = 65;
  const right = 20;
  const top = 30;
  const bottom = 38;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;

  const stepX = plotWidth / rows.length;
  const barWidth = Math.min(16, (stepX - 8) / 2);

  const floor = Math.min(0, ...rows.map(row => row.actual ?? 0), ...rows.map(row => row.target ?? 0)) * 1.15;
  const getY = (val: number) => chartHeight - bottom - ((val - floor) / (ceiling - floor)) * plotHeight;

  const selected = active !== null ? rows[active] : null;

  return (
    <div className="rm-report-chart" style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 16, padding: "20px 22px", marginBottom: 20, boxShadow: "0 2px 10px rgba(15,23,42,.06)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #f1f5f9" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📈</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
              {periodName} Sales vs Target{demo ? " · Demo" : ""}
            </h3>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
            {note ?? (period === "fytd" ? "Month-wise sales and targets for the selected financial year" : "Day-wise sales and targets for the selected dates")}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#94a3b8", display: "inline-block" }} />
            <span style={{ color: "#475569", fontWeight: 600 }}>Target</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#16a34a", display: "inline-block" }} />
            <span style={{ color: "#16a34a", fontWeight: 700 }}>Achieved (≥100%)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0284c7", display: "inline-block" }} />
            <span style={{ color: "#0284c7", fontWeight: 700 }}>Achieved (&lt;100%)</span>
          </div>
        </div>
      </div>

      {/* Mini summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14, background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <div>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{periodName} Sales</span>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{hasActualData ? formatRupees(totalActual) : "Data unavailable"}</div>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{periodName} Target Pace</span>
          <div style={{ fontSize: 15, fontWeight: 800, color: avgAchievement != null && avgAchievement >= 100 ? "#16a34a" : "#d97706" }}>
            {avgAchievement == null ? "Target data unavailable" : `${avgAchievement}% achieved`}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{period === "fytd" || granularity === "monthly" ? "Top Sales Month" : granularity === "weekly" || granularity === "source-week" ? "Top Sales Week" : "Top Sales Day"}</span>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0284c7" }}>
            {period === "today" ? formatRupees(totalTarget) : bestMonth ? <>{bestMonth.label} · {formatRupees(bestMonth.actual)}</> : "Data unavailable"}
          </div>
        </div>
      </div>

      {!hasChartValues && <p role="status" style={{ margin: "0 0 10px", color: "#64748b", fontSize: 12 }}>No Data Available — chart shown for the selected period.</p>}
      {/* Keep the selected bar's details beside the chart, away from its bars. */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }} onMouseLeave={() => setActive(null)}>
        <div className="rm-chart-plot" style={{ flex: "1 1 760px", minWidth: 0, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", minWidth: chartWidth, height: chartHeight, display: "block" }}>
          {/* Y-Axis Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = floor + (ceiling - floor) * ratio;
            const yPos = getY(val);
            return (
              <g key={ratio}>
                <line x1={left} x2={chartWidth - right} y1={yPos} y2={yPos} stroke="#e2e8f0" strokeDasharray={ratio === 0 ? "none" : "3 3"} strokeWidth={ratio === 0 ? 1.5 : 1} />
                <text x={left - 8} y={yPos + 4} textAnchor="end" fontSize="10.5" fill="#64748b" fontWeight="600">
                  {val >= 10000000 ? `₹${(val / 10000000).toFixed(1)}Cr` : val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : formatRupees(Math.round(val))}
                </text>
              </g>
            );
          })}

          {/* Period bars */}
          {rows.map((row, index) => {
            const groupX = left + index * stepX + stepX / 2;
            const targetX = groupX - barWidth - 1.5;
            const actualX = groupX + 1.5;

            const targetY = Math.min(getY(0), getY(row.target ?? 0));
            const targetH = Math.abs(getY(0) - getY(row.target ?? 0));

            const actualY = Math.min(getY(0), getY(row.actual ?? 0));
            const actualH = Math.abs(getY(0) - getY(row.actual ?? 0));

            const isMet = row.achievementPercent != null && row.achievementPercent >= 100;
            const actualColor = isMet ? "#16a34a" : "#0284c7";
            const isHovered = active === index;

            return (
              <g key={row.month}>
                {/* Target Bar */}
                {row.target != null && <rect
                  x={targetX}
                  y={targetY}
                  width={barWidth}
                  height={targetH}
                  rx="3"
                  fill="#94a3b8"
                  opacity={isHovered ? 1 : 0.8}
                />}

                {/* Actual Bar */}
                {row.actual != null && <rect
                  x={actualX}
                  y={actualY}
                  width={barWidth}
                  height={actualH}
                  rx="3"
                  fill={actualColor}
                  opacity={isHovered ? 1 : 0.95}
                />}

                {/* % text */}
                  {row.actual != null && row.actual > 0 && row.achievementPercent != null && (
                  <text
                    x={actualX + barWidth / 2}
                    y={actualY - 6}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="700"
                    fill={actualColor}
                  >
                    {row.achievementPercent}%
                  </text>
                )}

                {/* Period label */}
                <text
                  x={groupX}
                  y={chartHeight - bottom + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? "800" : "600"}
                  fill={isHovered ? "#0f172a" : "#475569"}
                >
                  {row.label}
                </text>

                {/* Hover hit rect */}
                <rect
                  x={left + index * stepX}
                  y={top}
                  width={stepX}
                  height={chartHeight - top - bottom}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(index)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${row.label} performance details`}
                />
              </g>
            );
          })}
        </svg>
        </div>

        <div className="rm-chart-side-slot" style={{ flex: "0 0 220px" }}>
          {selected && (
          <div className="rm-chart-details" role="status" aria-live="polite" style={{ boxSizing: "border-box", minHeight: 132, background: "#0f172a", color: "#ffffff", padding: "10px 14px", borderRadius: 10, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.22)", fontSize: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13, borderBottom: "1px solid #334155", paddingBottom: 5, marginBottom: 5 }}>
              {selected.label} Performance
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
              <span style={{ color: "#94a3b8" }}>Target:</span>
            <strong>{selected.target == null ? "Data unavailable" : formatRupees(selected.target)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
              <span style={{ color: "#94a3b8" }}>Actual Sales:</span>
              <strong style={{ color: (selected.achievementPercent ?? 0) >= 100 ? "#4ade80" : "#38bdf8" }}>
                {selected.actual == null ? "Data unavailable" : formatRupees(selected.actual)}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #334155", paddingTop: 4, marginTop: 4 }}>
              <span style={{ color: "#94a3b8" }}>Achievement:</span>
              <strong style={{ color: (selected.achievementPercent ?? 0) >= 100 ? "#4ade80" : "#fbbf24" }}>
                {selected.achievementPercent == null ? "Data unavailable" : `${selected.achievementPercent}%`}
              </strong>
            </div>
          </div>
          )}
        </div>
      </div>
      {rows.length > 4 && <p className="rm-chart-scroll-hint">Swipe chart sideways to see more {isShortPeriod ? "days" : "months"} →</p>}
    </div>
  );
}

/* ── Thrust Products Card (Strategic Products Overview) ── */
function ThrustProductsCard({
  thrust,
}: {
  thrust?: {
    products: Array<{
      id: string;
      name: string;
      ytdSalesRupees: number | null;
      ytdSalesLakh: number | null;
      quantity: number | null;
      invoiceCount: number | null;
      isSold: boolean | null;
      isDemo?: boolean;
    }>;
    totalYtdLakh: number | null;
    totalSalesRupees: number | null;
    activeCount: number | null;
    totalCount: number;
    financialYear?: string;
    source?: string;
    hasDemoProducts?: boolean;
  };
}) {
  if (!thrust || !thrust.products || thrust.products.length === 0) return null;

  return (
    <div className="rm-report-thrust"
      style={{
        background: "#ffffff",
        border: "1.5px solid #cbd5e1",
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 20,
        boxShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              display: "grid",
              placeItems: "center",
              fontSize: 17,
              color: "#ffffff",
              boxShadow: "0 3px 8px rgba(2, 132, 199, 0.3)",
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.01em",
                }}
              >
                {thrust.source === "supplied_pdf_snapshot" ? "Strategic Thrust Products" : "Thrust Products - Selected Period Sales"}
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                }}
              >
                Strategic Focus {thrust.financialYear ?? "2024-25"}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b" }}>
              {thrust.source === "supplied_pdf_snapshot" ? "Reported product portfolio · Individual sales not provided by source" : `Annual priority portfolio decided at year start · ${thrust.activeCount} of ${thrust.totalCount} products active with sales`}
            </p>
          </div>
        </div>

        {/* Total Highlight Pill (Matching user sheet gold/yellow callout) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "linear-gradient(135deg, #fefce8 0%, #fef08a 100%)",
            border: "1.5px solid #facc15",
            borderRadius: 12,
            padding: "8px 16px",
            boxShadow: "0 2px 8px rgba(234, 179, 8, 0.2)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "#854d0e" }}>Total Thrust Sales</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#713f12", lineHeight: 1.1 }}>{thrust.totalSalesRupees == null ? "Unavailable" : formatRupees(thrust.totalSalesRupees)}</div>
          </div>
        </div>
      </div>

      {/* Source PDFs list products without product-level revenue. Keep those names compact. */}
      {thrust.source === "supplied_pdf_snapshot" && thrust.products.every(p => p.ytdSalesRupees == null) ? (
        <div className="rm-thrust-name-list">
          {thrust.products.map((product, index) => <span key={product.id}><small>{String(index + 1).padStart(2, "0")}</small>{product.name}</span>)}
        </div>
      ) : <div className="rm-thrust-grid">
        {thrust.products.map((p, idx) => {
          const isSold = p.isSold;
          return (
            <div
              key={p.id}
              style={{
                borderRadius: 12,
                padding: "12px 14px",
                border: isSold ? "1.5px solid #86efac" : "1px solid #e2e8f0",
                background: isSold
                  ? "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)"
                  : "#f8fafc",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 6,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isSold ? "#166534" : "#475569",
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: isSold ? "#15803d" : "#94a3b8",
                    background: isSold ? "#dcfce7" : "#e2e8f0",
                    padding: "1px 5px",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                >
                  #{idx + 1}
                </span>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: isSold ? "#0f172a" : "#94a3b8",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {p.ytdSalesLakh == null ? "—" : p.ytdSalesLakh > 0 ? `${p.ytdSalesLakh.toFixed(2)} L` : "0.00 L"}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: isSold ? "#16a34a" : "#94a3b8",
                    fontWeight: 600,
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{p.isDemo ? "Demo sales" : p.ytdSalesRupees == null ? "Not provided in source" : isSold ? formatRupees(p.ytdSalesRupees) : "No sales recorded"}</span>
                  {p.invoiceCount != null && p.invoiceCount > 0 && (
                    <span style={{ fontSize: 9.5, color: "#64748b" }}>
                      {p.invoiceCount} inv
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

/* ── Report Card "Performance" tab ── */
function ReportCardTab({ data, kpi, period, onSelectTab }: { data: any; kpi: any; period: Period; onSelectTab?: (tab: Tab) => void }) {
  const target = kpi.targetValue;
  const actual = kpi.actualSalesValue ?? 0;
  const hasActual = kpi.actualSalesValue != null;
  const pct = kpi.achievementPercent;
  const periodChartRows = period !== "fytd"
    ? data.periodChartRows ?? [{ month: data.to ?? period, label: period === "today" ? "Today" : "This Week", target: target ?? null, actual: hasActual ? actual : null, achievementPercent: pct ?? null }]
    : data.monthlyTargetVsActual;
  const pctValue = pct ?? 0;
  const remaining = target == null || !hasActual ? null : Math.max(0, target - actual);

  const isToday = period === "today";
  const isWeek = period === "week";
  const isMonth = period === "month";
  const isFytd = period === "fytd";
  const isUnder = pct != null && !isToday && pct < 50;

  const targetLabel = isToday
    ? "Daily Target"
    : isWeek
    ? "Weekly Target"
    : isMonth
    ? "Monthly Target"
    : "Yearly Target";

  // Determine status label, badge theme, subtitle and icon
  let statusLabel = "Data unavailable";
  let statusSub = "No reliable target is mapped for this reporting period.";
  let statusTheme: "green" | "amber" | "red" | "blue" = "blue";

  if (pct != null && isToday) {
    if (target != null && actual >= target && target > 0) {
      statusLabel = "Daily Quota Met";
      statusSub = `${formatRupees(actual)} billed today (${Math.round(pct)}% pace)`;
      statusTheme = "green";
    } else if (actual > 0) {
      statusLabel = "Daily Billing Active";
      statusSub = `${formatRupees(actual)} billed today · Quota: ${formatRupees(target)}`;
      statusTheme = pctValue >= 50 ? "green" : "amber";
    } else {
      statusLabel = "Daily Invoicing Open";
      statusSub = `No billing logged today · Daily quota: ${formatRupees(target)}`;
      statusTheme = "blue";
    }
  } else if (pct != null && isWeek) {
    if (pctValue >= 80) {
      statusLabel = "Weekly On Track";
      statusSub = `${Math.round(pct)}% of weekly quota achieved`;
      statusTheme = "green";
    } else if (pctValue >= 40) {
      statusLabel = "Weekly In Progress";
      statusSub = `${Math.round(pct)}% achieved · Target: ${formatRupees(target)}`;
      statusTheme = "amber";
    } else {
      statusLabel = "Weekly Pace Alert";
      statusSub = `${Math.round(pct)}% achieved · Target: ${formatRupees(target)}`;
      statusTheme = "red";
    }
  } else if (pct != null) {
    // Month or FYTD
    if (pctValue >= 80) {
      statusLabel = "On Track";
      statusSub = `${Math.round(pct)}% of target achieved`;
      statusTheme = "green";
    } else if (pctValue >= 50) {
      statusLabel = "Moderate Pace";
      statusSub = `${Math.round(pct)}% of target achieved`;
      statusTheme = "amber";
    } else {
      statusLabel = "Under Quota Pace";
      statusSub = `${Math.round(pct)}% of target achieved`;
      statusTheme = "red";
    }
  }

  const themeMap = {
    green: {
      bg: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      border: "#86efac",
      shadow: "0 4px 12px rgba(22,163,74,0.1)",
      iconBg: "linear-gradient(135deg, #22c55e, #16a34a)",
      iconShadow: "0 4px 10px rgba(22,163,74,0.3)",
      title: "#166534",
      sub: "#15803d",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      ),
    },
    amber: {
      bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
      border: "#fde68a",
      shadow: "0 4px 12px rgba(217,119,6,0.1)",
      iconBg: "linear-gradient(135deg, #f59e0b, #d97706)",
      iconShadow: "0 4px 10px rgba(217,119,6,0.3)",
      title: "#92400e",
      sub: "#b45309",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      ),
    },
    blue: {
      bg: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      border: "#bae6fd",
      shadow: "0 4px 12px rgba(2,132,199,0.1)",
      iconBg: "linear-gradient(135deg, #0284c7, #0369a1)",
      iconShadow: "0 4px 10px rgba(2,132,199,0.3)",
      title: "#075985",
      sub: "#0284c7",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
    },
    red: {
      bg: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
      border: "#fca5a5",
      shadow: "0 4px 12px rgba(220,38,38,0.1)",
      iconBg: "linear-gradient(135deg, #ef4444, #dc2626)",
      iconShadow: "0 4px 10px rgba(220,38,38,0.3)",
      title: "#991b1b",
      sub: "#b91c1c",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
      ),
    },
  };
  const theme = themeMap[statusTheme];

  const periodLabel = data.reportLabel ?? "Selected period";
  const compactPeriodLabel = data.selectedPeriod ? `${data.selectedPeriod.label} · ${formatDate(data.from)} – ${formatDate(data.to)}` : periodLabel;

  const demoDealers = Boolean(data.demoSections?.dealers);
  const demoProducts = Boolean(data.demoSections?.products);
  const demoPipeline = Boolean(data.demoSections?.pipeline);
  const topDealers: Array<{ dealerName: string; salesValue: number }> = data.topDealers ?? [];
  const dealerTotal = kpi.actualSalesValue || 0;
  const totalDealersCount = data.activeDealerCount ?? 0;
  const dependencyPct = data.topFiveDealerConcentrationPercent;
  const newCustomersCount = data.newCustomersCount;

  /* product performance — slice TOP 5 for summary card */
  const allProducts = data.topProducts ?? [];
  const topProducts = allProducts.slice(0, 5);
  const productTotal = allProducts.reduce((s: number, p: any) => s + p.salesValue, 0) || 1;

  const dormant = data.dormantDealers ?? [];

  return (
    <div className="rm-report-card" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* ── Friendly Profile & Performance Hero Card ── */}
      <div className="rm-report-profile" style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 20,
        boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        {/* Top Row: Avatar + Identity + Performance Badge */}
        <div className="rm-report-profile-main" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className="rm-report-identity" style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 260 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 800,
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.25)",
              flexShrink: 0,
            }}>
              {data.name?.slice(0, 1) ?? "R"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                  {data.name}
                </h2>
                {data.livePreviewDemo && <span style={{ background: "#fffbeb", border: "1px solid #fbbf24", color: "#92400e", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>Demo preview</span>}
                {data.rmCode && (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}>
                    RM {data.rmCode}
                  </span>
                )}
                <span style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                }}>
                  {data.region ?? "North Region"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  📍 <strong>{data.operatingFrom || data.operatingCities?.[0] || "Gurugram"}</strong>
                </span>
                <span>•</span>
                <span title={periodLabel}>📅 Period: <strong style={{ color: "#0f172a" }}>{compactPeriodLabel}</strong></span>
                {data.financialSource?.asOf && <span>Source as of {formatDate(data.financialSource.asOf)}</span>}
                {target != null && target > 0 && (
                  <>
                    <span>•</span>
                    <span>🎯 {targetLabel}: <strong style={{ color: "#0f172a" }}>{formatRupees(target)}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Header: Clock Status + Performance Metric Card */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginLeft: "auto" }}>
            {/* RM Clock-in / Clock-out Badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 650,
              background: data.attendance?.checkOutAt
                ? "#f0fdf4"
                : data.attendance?.checkInAt
                ? "#eff6ff"
                : "#f8fafc",
              color: data.attendance?.checkOutAt
                ? "#166534"
                : data.attendance?.checkInAt
                ? "#1d4ed8"
                : "#64748b",
              border: `1px solid ${
                data.attendance?.checkOutAt
                  ? "#bbf7d0"
                  : data.attendance?.checkInAt
                  ? "#bfdbfe"
                  : "#e2e8f0"
              }`,
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: data.attendance?.checkOutAt
                  ? "#16a34a"
                  : data.attendance?.checkInAt
                  ? "#2563eb"
                  : "#94a3b8",
              }} />
              {data.attendance?.checkOutAt
                ? `Clocked Out: ${new Date(data.attendance.checkOutAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
                : data.attendance?.checkInAt
                ? `Clocked In: ${new Date(data.attendance.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
                : "No check-in on period end date"}
              {data.attendance?.checkInAt && data.attendance?.checkOutAt && (
                <span style={{ fontSize: 11, color: "#64748b", marginLeft: 4 }}>
                  (In: {new Date(data.attendance.checkInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })})
                </span>
              )}
            </div>

            {/* Performance Status Chip */}
            <div
              style={{
                background: theme.bg,
                border: `1.5px solid ${theme.border}`,
                borderRadius: 12,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: theme.shadow,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: theme.iconBg,
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  boxShadow: theme.iconShadow,
                  flexShrink: 0,
                }}
              >
                {theme.icon}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: theme.title }}>
                  Performance Status
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: theme.title, lineHeight: 1.2 }}>
                  {statusLabel}
                </div>
                <div style={{ fontSize: 11, fontWeight: 650, color: theme.sub, marginTop: 1 }}>
                  {statusSub}
                </div>
              </div>
            </div>
          </div>
        </div>

        <ExecutiveTerritoryCoverage coverage={data.executiveTerritoryCoverage} />
      </div>

      {data.technicalService && <div className="rm-report-service"><TechnicalServiceDetails service={data.technicalService} compact /></div>}

      {/* ── Key Performance Highlights / Milestones Strip ── */}
      {!!data.specialAchievements?.length && <div className="rm-report-achievements" style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: "14px 18px",
        marginBottom: 20,
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🌟</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: ".03em" }}>
            Special Achievements &amp; Milestones
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {(data.specialAchievements ?? []).map((item: string, index: number) => <span key={index} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{item}</span>)}
        </div>
      </div>}

      <div className="rm-report-briefings">
      <div className="admin-card rm-report-insights" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>AI Insights — {data.name}</h2>
        <InsightPanel data={data.insightSource ?? data} period={period} onOpenActions={() => onSelectTab?.("actionplan")} />
      </div>

      <div className="admin-card rm-report-actions" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Manager Action Plan — {data.name}</h2>
        <ManagerActionPlanTab data={data.insightSource ?? data} />
      </div>
      </div>

      {/* ── Sales chart for the selected reporting period ── */}
      <TargetVsActualChart note={data.chartNote} granularity={data.chartGranularity} key={period} rows={periodChartRows} period={period} sourceDate={data.reportSource?.asOf} annualPerformance={{ actual: kpi.actualSalesValue, target: kpi.targetValue, achievementPercent: kpi.achievementPercent }} demo={data.financialSource ? false : period === "month" ? data.monthlyChartDemo : data.livePreviewDemo} />

      {/* ── Thrust Products & Actual Sales Till Date ── */}
      <ThrustProductsCard thrust={data.thrustProducts} />

      {/* ── Customer Health & Dependency ── */}
      {dependencyPct == null && newCustomersCount == null ? (
        <div className="rm-report-health rm-report-health-note">Dealer concentration and new-customer counts are unavailable from the current source.</div>
      ) : <div className="rm-2col-grid rm-report-health">
        <div style={{ background: dependencyPct > 80 ? "#fff1f2" : "#f8fafc", border: `1.5px solid ${dependencyPct > 80 ? "#fda4af" : "#cbd5e1"}`, borderRadius: 12, padding: "16px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, color: dependencyPct > 80 ? "#9f1239" : "#334155", textTransform: "uppercase", fontWeight: 800 }}>Revenue Dependency Risk</h4>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
            {dependencyPct === null ? "Unavailable" : `${dependencyPct}% of sales come from the top ${Math.min(5, totalDealersCount)} dealers`} <span style={{ fontWeight: 400, color: "#64748b" }}>(out of {totalDealersCount} total active)</span>
          </p>
        </div>
        <div style={{ background: newCustomersCount == null ? "#f8fafc" : "#f0fdf4", border: `1.5px solid ${newCustomersCount == null ? "#cbd5e1" : "#86efac"}`, borderRadius: 12, padding: "16px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, color: newCustomersCount == null ? "#334155" : "#166534", textTransform: "uppercase", fontWeight: 800 }}>New Acquisition</h4>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
            {newCustomersCount == null ? "Data unavailable" : `${newCustomersCount} new customers`} <span title={data.newCustomersUnavailableReason ?? ""} style={{ fontWeight: 400, color: "#64748b" }}>{newCustomersCount == null ? "· Customer creation dates not recorded" : "in the selected period"}</span>
          </p>
        </div>
      </div>}

      {/* ── 6 KPI cards ── */}
      <div className="rm-kpi-grid rm-report-kpis">
        <KpiCard icon="🎯" iconBg="#e0f2fe" label={targetLabel} value={target == null ? "Data unavailable" : formatRupees(target)} />
        <KpiCard icon="📊" iconBg="#dcfce7" label="Actual Sales" value={hasActual ? formatRupees(actual) : "Data unavailable"} />
        {/* Customers Visited */}
        <div style={kpiCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#e0f2fe", display: "grid", placeItems: "center", fontSize: 14 }}>👥</span>
            <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Visited</span>
          </div>
          <strong style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{formatNumber(kpi.visitsCompleted)}</strong>
          <small style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "block", marginTop: 2 }}>of {formatNumber(kpi.visitsPlanned)} planned</small>
        </div>
        <KpiCard icon="📞" iconBg="#ffedd5" label="Calls logged" value={formatNumber(kpi.callsLogged ?? 0)} />
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
      <div className="rm-2col-grid rm-report-sales">
        {/* Sales vs Target */}
        <div style={cardStyle}>
          <p style={cardTitleStyle} title={periodLabel}>📈 Sales vs Target</p>
          
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Target Achievement</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: isUnder ? "#dc2626" : "#16a34a" }}>
                {pct == null ? "Data unavailable" : `${pct}%`} <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>({hasActual ? formatRupees(actual) : "Data unavailable"})</span>
              </span>
            </div>
            
            {/* Visual Progress Bar */}
            <div style={{ height: 12, width: "100%", background: "#f1f5f9", borderRadius: 8, overflow: "hidden", border: "1px solid #cbd5e1" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(1, pct ?? 0))}%`,
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
                <strong style={{ color: "#0f172a", fontWeight: 800 }}>{target == null ? "Data unavailable" : formatRupees(target)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", fontWeight: 600 }}>Actual: </span>
                <strong style={{ color: "#0284c7", fontWeight: 800 }}>{hasActual ? formatRupees(actual) : "Data unavailable"}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: ".04em" }}>Remaining to Target</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#991b1b", marginTop: 1 }}>{remaining == null ? "Data unavailable" : formatRupees(remaining)}</div>
            </div>
            <span style={{ fontSize: 20 }}>⚠️</span>
          </div>
        </div>

        {/* Pipeline */}
        <div style={cardStyle}>
          <p style={cardTitleStyle}>🛒 Pipeline (Expected Orders){demoPipeline ? " · Demo" : ""}</p>
          <strong style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", display: "block", marginTop: 10 }}>{formatRupees(kpi.expectedOrdersValue)}</strong>
          <small style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{demoPipeline ? "Demo pipeline value" : "Total pipeline value"}</small>
          {!data.pipeline.length && <p className="admin-muted">No Data Available</p>}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.pipeline ?? []).slice(0, 4).map((p: any) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.customerName}{p.productName && <small style={{ display: "block", color: "#64748b", fontWeight: 500 }}>{p.productName} · {formatDate(p.expectedDate)}</small>}</span>
                <span style={{ fontSize: 12, color: "#0284c7", fontWeight: 800 }}>{formatRupees(p.expectedValue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Top dealers + Dormant + Product performance ── */}
      <div className="rm-3col-grid rm-tables-row rm-report-tables">
        {/* Top 5 Dealers */}
        <div style={cardStyle}>
          <p style={cardTitleStyle} title={periodLabel}>👤 Top 5 Customers by Revenue{demoDealers ? " · Demo" : ""}</p>
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
              {!topDealers.length && <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>No Data Available</td></tr>}
              {topDealers.map((d, i) => {
                const pctShare = Math.round((d.salesValue / (dealerTotal || 1)) * 100);
                return (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#64748b", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "8px 4px", fontWeight: 700, color: "#0f172a" }}>{demoDealers ? d.dealerName : <Link href={`/admin/customers?search=${encodeURIComponent(d.dealerName)}`}>{d.dealerName}</Link>}</td>
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
          <p style={cardTitleStyle}>🕐 Dormant dealers (no invoice for {data.reportingThresholds?.dormantDays ?? 90}+ days)</p>
          {data.reportingThresholds?.provisional && <small style={{ color: "#a16207" }}>The inactivity threshold is provisional; confirm it before acting.</small>}
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
                  <td colSpan={2} style={{ textAlign: "center", color: data.ownershipMapping === "verified" ? "#16a34a" : "#a16207", padding: "24px 0", fontWeight: 700 }}>
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px", display: "inline-block" }}>
                      {data.ownershipMapping === "verified" ? "✓ No dormant dealers" : "Data unavailable until RM ownership is mapped"}
                    </div>
                  </td>
                </tr>
              ) : dormant.map((d: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 4px", fontWeight: 700, color: "#0f172a" }}><Link href={`/admin/customers?search=${encodeURIComponent(d.dealerName ?? d.name)}`}>{d.dealerName ?? d.name}</Link></td>
                  <td style={{ padding: "9px 4px", textAlign: "right" }}>
                    <span style={{ background: monthsAgoColor(d.lastInvoice) + "18", color: monthsAgoColor(d.lastInvoice), border: `1px solid ${monthsAgoColor(d.lastInvoice)}33`, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                      {formatDate(d.lastInvoiceDate ?? d.lastInvoice)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!!data.dealerIntelligence?.noSalesInSelectedPeriod?.length && <>
            <h5 style={{ margin: "16px 0 6px" }}>Previously billed, no sales in selected period ({data.dealerIntelligence.noSalesInSelectedPeriod.length})</h5>
            {data.dealerIntelligence.noSalesInSelectedPeriod.slice(0, 8).map((dealer: any) => <p key={dealer.id} style={{ margin: "5px 0", fontSize: 12 }}><Link href={`/admin/customers?search=${encodeURIComponent(dealer.name)}`}>{dealer.name}</Link> · last invoice {formatDate(dealer.lastInvoiceDate) ?? "—"} · {dealer.followUpOpportunity}</p>)}
          </>}
          {!!data.dealerIntelligence?.declining?.length && <>
            <h5 style={{ margin: "16px 0 6px" }}>Declining vs prior comparable period ({data.dealerIntelligence.declining.length})</h5>
            {data.dealerIntelligence.declining.slice(0, 8).map((dealer: any) => <p key={dealer.id} style={{ margin: "5px 0", fontSize: 12 }}><Link href={`/admin/customers?search=${encodeURIComponent(dealer.name)}`}>{dealer.name}</Link> · down {dealer.declinePercent}% · {formatRupees(dealer.previousSalesValue)} to {formatRupees(dealer.salesValue)}</p>)}
          </>}
          {!!data.dealerIntelligence?.insufficientHistory?.length && <small style={{ display: "block", marginTop: 10, color: "#64748b" }}>{data.dealerIntelligence.insufficientHistory.length} dealer records need more invoice history for trend or inactivity analysis.</small>}
        </div>

        {/* Product Performance (Top 5) */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>📦 Product Performance (Top 5){demoProducts ? " · Demo" : ""}</p>
            {onSelectTab && !demoProducts && allProducts.length > 5 && (
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
              {!topProducts.length && <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>No Data Available</td></tr>}
              {topProducts.map((p: any, i: number) => (
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
function InsightPanel({ data, period, onOpenActions }: { data: any; period: Period; onOpenActions: () => void }) {
  const details = rmDetailedInsights(data, period);
  return (
    <section className="rm-insight rm-insight-dashboard">
      {details.length > 0 && <section className="rm-insight-details" aria-label="Detailed AI insights" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        <div className="rm-insight-heading">
          <h3>Detailed insights</h3>
          <button type="button" className="admin-button ghost small" onClick={onOpenActions}>View next steps</button>
        </div>
        <p className="rm-insight-detail-source">{data.reportSource?.asOf ? `Using the report dated ${formatDate(data.reportSource.asOf)}.` : "Using the CRM records for these dates."} Talk to the RM before deciding what to do next.</p>
        <ol className="rm-insight-detail-list">
          {details.map(item => <li key={item.id}>
            <h4>{item.title}</h4>
            <ul>{item.points.map((point, index) => <li key={index}>{point}</li>)}</ul>
          </li>)}
        </ol>
      </section>}
      {!details.length && <p className="admin-placeholder">There is not enough past data to compare sales yet.</p>}
    </section>
  );
}

function ManagerActionPlanTab({ data }: { data: any }) {
  const items = rmManagementBriefs(data);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item: any, index: number) => <article key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <strong style={{ flex: "1 1 200px", fontSize: 14, color: "#0f172a" }}>{index + 1}. {item.title}</strong>
          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "3px 7px", background: item.severity === "high" ? "#fff1f2" : "#f1f5f9", color: item.severity === "high" ? "#be123c" : "#475569" }}>{item.severity === "high" ? "Do this first" : "Check this"}</span>
        </div>
        {item.finding && <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12 }}>{item.finding}</p>}
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#1e293b", fontSize: 13, lineHeight: 1.6 }}>
          {item.actions.map((action: string) => <li key={action}>{action}</li>)}
        </ul>
        {item.href && <Link href={item.href} style={{ fontSize: 12 }}>View records</Link>}
      </article>)}
      {!items.length && <p className="admin-placeholder">The available records show nothing that needs action right now.</p>}
    </div>
  );
}

/* ── Main component ── */
export function AdminRmDetail(props: { rmId: string; audience?: "admin" | "rm" }) {
  return <RmPerformanceWorkspace {...props} />;
}

// Retained for the existing legacy report implementation; V2 uses a normalized projection.
function LegacyAdminRmDetail({ rmId: initialRmId, audience = "admin" }: { rmId: string; audience?: "admin" | "rm" }) {
  const [tab, setTab] = useState<Tab>("performance");
  const [rmId, setRmId] = useState(initialRmId);
  const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => { setRmId(initialRmId); }, [initialRmId]);
  useEffect(() => { if (audience === "admin") adminApi.rmReportOptions().then(result => setManagers(result.managers)).catch(() => {}); }, [audience]);
  const [selection, setSelection] = useState<RmReportSelection>(() => {
    const date = indiaBusinessDate();
    const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
    return { reportType: "monthly", financialYear: `${year}-${String(year + 1).slice(-2)}`, month: Number(date.slice(5, 7)), week: 1 };
  });
  const period: Period = selection.reportType === "weekly" ? "week" : selection.reportType === "yearly" ? "fytd" : "month";
  const [showPreview, setShowPreview] = useState(false);
  const filterFormId = useId();
  const [previewRequested, setPreviewRequested] = useState(false);
  const reportSection = useRef<HTMLDivElement>(null);
  const [openReport, setOpenReport] = useState(false);
  const { from, to } = rmReportPeriod(selection);
  function changeSelection(next: RmReportSelection, nextRm?: string, download = false) {
    const unchanged = JSON.stringify(next) === JSON.stringify(selection) && (!nextRm || nextRm === rmId);
    if (download && unchanged && currentSourceData) {
      setShowPreview(true);
      return;
    }
    setTab("performance");
    setOpenReport(true);
    setShowPreview(false);
    setPreviewRequested(download);
    setSelection(next);
    if (audience === "admin" && nextRm) setRmId(nextRm);
    if (JSON.stringify(next) === JSON.stringify(selection) && (!nextRm || nextRm === rmId)) reload();
  }

  const { data: sourceData, loading, error, reload } = useAdminData(
    () => audience === "rm" ? rmApi.periodReport(selection) : adminApi.rmPeriodReport(rmId, selection),
    [rmId, from, to, period, audience],
    `actual-rm-${audience}-${rmId}-${from}-${to}-${period}`,
    true
  );
  // Keep the previous period out of view while the new request is loading.
  const currentSourceData = sourceData?.from === from && sourceData?.to === to && (audience === "rm" || sourceData?.id === rmId) ? sourceData : null;

  const data = raisKhanReportPresentation(currentSourceData);
  const reportData = data;
  const activityData = data ? { ...data, demoSections: data.demoSections ?? {}, activitySalesTotal: data.kpi.actualSalesValue } : null;
  const kpi = data?.kpi;
  useEffect(() => {
    if (!previewRequested || loading || !currentSourceData) return;
    setShowPreview(true);
    setPreviewRequested(false);
  }, [previewRequested, loading, currentSourceData]);
  useEffect(() => {
    if (!openReport || !currentSourceData) return;
    const frame = requestAnimationFrame(() => {
      reportSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      reportSection.current?.focus({ preventScroll: true });
      setOpenReport(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [openReport, currentSourceData]);

  return (
    <>
      {audience === "admin" && <nav className="rm-detail-back-nav" aria-label="Team navigation">
        <Link href="/admin/team" className="rm-detail-back">
          ← Back to Team performance
        </Link>
      </nav>}

      <AdminPage
        className="rm-detail-page"
        eyebrow="RM Report Card"
        title={data?.name ?? "RM Sales Activity"}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {data && (
              <button
                type="submit"
                form={filterFormId}
                name="reportAction"
                value="download"
                className="rm-download-report-btn"
                disabled={loading}
                title="Apply selected filters, preview and download report card"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
            )}
          </div>
        }
      >
        <RmPeriodFilters formId={filterFormId} ownRmId={currentSourceData?.id} selection={selection} onApply={changeSelection} rmId={rmId} managers={managers} canSelectRm={audience === "admin"} loading={loading || (!currentSourceData && !error)} />
        <AdminState loading={loading || !currentSourceData} error={error} onRetry={reload} empty={false}>
          {data && kpi && (
            <>
              {!data.hasRecords && <p className="admin-placeholder" role="status">No Data Available</p>}
              {/* Tabs */}
              <div ref={reportSection} tabIndex={-1} className="rm-report-section" aria-label="Selected RM report">
              <div className="admin-tabs" role="tablist" style={{ marginBottom: 24 }}>
                {TABS.filter(t => audience === "admin" || !["actionplan", "insight"].includes(t.id)).map((t) => (
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
              </div>





              {/* ── Report Card tab ── */}
              {tab === "performance" && (
                <ReportCardTab data={reportData} kpi={reportData.kpi} period={period} onSelectTab={setTab} />
              )}

              {/* ── Customer Visits tab ── */}
              {tab === "visits" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">CRM field activity</p>
                      <h2>Customer visit log {activityData.demoSections.visits && <span className="admin-pill neutral">Demo</span>}</h2>
                    </div>
                  </header>
                  {activityData.customerVisits.length === 0 ? (
                    <p className="admin-placeholder">No Data Available</p>
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
                          {activityData.customerVisits.map((v: any) => (
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
                      <h2>Sales pipeline {activityData.demoSections.pipeline && <span className="admin-pill neutral">Demo</span>}</h2>
                    </div>
                  </header>
                  {activityData.pipeline.length === 0 ? (
                    <p className="admin-placeholder">No Data Available</p>
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
                          {activityData.pipeline.map((p: any) => (
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
                      <p className="admin-eyebrow">{activityData.demoSections.sales ? "Sample invoices" : "Tally data"}</p>
                      <h2>Actual sales invoices {activityData.demoSections.sales && <span className="admin-pill neutral">Demo</span>}</h2>
                    </div>
                    <div className="admin-card-header-right">
                      <dl className="admin-card-summary">
                        <div>
                          <dt>Total</dt>
                          <dd><strong>{formatRupees(activityData.activitySalesTotal)}</strong></dd>
                        </div>
                        <div>
                          <dt>Invoices</dt>
                          <dd>{formatNumber(activityData.salesInvoiceCount ?? kpi.salesInvoiceCount ?? activityData.actualSales.length)}</dd>
                        </div>
                        <div>
                          <dt>Avg invoice</dt>
                          <dd>{(activityData.salesInvoiceCount ?? kpi.salesInvoiceCount ?? activityData.actualSales.length) > 0 ? formatRupees(activityData.activitySalesTotal / (activityData.salesInvoiceCount ?? kpi.salesInvoiceCount ?? activityData.actualSales.length)) : "—"}</dd>
                        </div>
                      </dl>
                    </div>
                  </header>
                  {activityData.actualSales.length === 0 ? (
                    <p className="admin-placeholder">No Data Available</p>
                  ) : (
                    <div className="admin-table-wrap">
                      {activityData.salesInvoiceCount > activityData.actualSales.length && <p className="admin-muted">Showing the 50 most recent invoices of {formatNumber(activityData.salesInvoiceCount)} eligible invoices; totals above include the full period.</p>}
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
                          {activityData.actualSales.map((s: any) => (
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
                      <h2>Top products sold by {activityData.name} {activityData.demoSections.products && <span className="admin-pill neutral">Demo</span>}</h2>
                    </div>
                  </header>
                  {activityData.topProducts.length === 0 ? (
                    <p className="admin-placeholder">No Data Available</p>
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
                          {activityData.topProducts.map((p: any) => (
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
                      <h2>Open follow-ups {activityData.demoSections.followups && <span className="admin-pill neutral">Demo</span>}</h2>
                    </div>
                  </header>
                  {activityData.followUps.length === 0 ? (
                    <p className="admin-placeholder">No Data Available</p>
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
                          {activityData.followUps.map((f: any) => (
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
                  <InsightPanel data={data} period={period} onOpenActions={() => setTab("actionplan")} />
                </div>
              )}

              {/* ── Manager Action Plan tab ── */}
              {tab === "actionplan" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Next steps</p>
                      <h2>Manager Action Plan — {data.name}</h2>
                    </div>
                  </header>
                  <ManagerActionPlanTab data={data} />
                </div>
              )}
            </>
          )}
        </AdminState>
      </AdminPage>

      {/* In-Page Report Preview Modal (NO NEXT PAGE OPENS!) */}
      {data && (
        <RmReportPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          data={reportData}
          period={period}
        />
      )}
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
  minWidth: 0, overflowX: "auto",
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

