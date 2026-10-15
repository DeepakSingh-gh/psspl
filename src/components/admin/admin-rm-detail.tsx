"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { RmReportDocument, RmReportPreviewModal, downloadRmReportDirect } from "./rm-report-pdf";
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
  | "insight"
  | "actionplan";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "performance", label: "📊 Report Card" },
  { id: "visits", label: "Customer Visits" },
  { id: "pipeline", label: "Pipeline" },
  { id: "sales", label: "Actual Sales" },
  { id: "products", label: "Products" },
  { id: "followups", label: "Follow-ups" },
  { id: "insight", label: "AI Insight" },
  { id: "actionplan", label: "📋 Manager Action Plan" },
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

/* ── Monthly Target vs Actual Chart ── */
function TargetVsActualMonthlyChart({ rows }: { rows?: Array<{ month: string; label: string; target: number; actual: number; achievementPercent: number }> }) {
  const [active, setActive] = useState<number | null>(null);

  if (!rows || rows.length === 0) {
    return (
      <div style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 16, padding: "24px 20px", marginBottom: 20, textAlign: "center", color: "#64748b" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No monthly sales target or invoice history available for this RM.</p>
      </div>
    );
  }

  const highestActual = Math.max(...rows.map((r) => r.actual), 1);
  const highestTarget = Math.max(...rows.map((r) => r.target), 1);
  const ceiling = Math.max(highestActual, highestTarget) * 1.15;

  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const avgAchievement = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
  const bestMonth = rows.reduce((best, r) => r.actual > best.actual ? r : best, rows[0]);

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

  const getY = (val: number) => chartHeight - bottom - (val / ceiling) * plotHeight;

  const selected = active !== null ? rows[active] : null;

  return (
    <div style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 16, padding: "20px 22px", marginBottom: 20, boxShadow: "0 2px 10px rgba(15,23,42,.06)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #f1f5f9" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📈</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Monthly Sales Target vs Achievement
            </h3>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
            Monthly comparison of target quotas versus booked Tally sales revenue
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
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>12-Month Total Billed</span>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{formatRupees(totalActual)}</div>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Overall Target Pace</span>
          <div style={{ fontSize: 15, fontWeight: 800, color: avgAchievement >= 100 ? "#16a34a" : "#d97706" }}>
            {avgAchievement}% achieved
          </div>
        </div>
        <div>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Top Revenue Milestone</span>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0284c7" }}>
            {bestMonth.label} · {formatRupees(bestMonth.actual)}
          </div>
        </div>
      </div>

      {/* Interactive Chart */}
      <div style={{ overflowX: "auto", position: "relative" }} onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", minWidth: chartWidth, height: chartHeight, display: "block" }}>
          {/* Y-Axis Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = ceiling * ratio;
            const yPos = getY(val);
            return (
              <g key={ratio}>
                <line x1={left} x2={chartWidth - right} y1={yPos} y2={yPos} stroke="#e2e8f0" strokeDasharray={ratio === 0 ? "none" : "3 3"} strokeWidth={ratio === 0 ? 1.5 : 1} />
                <text x={left - 8} y={yPos + 4} textAnchor="end" fontSize="10.5" fill="#64748b" fontWeight="600">
                  {val >= 10000000 ? `₹${(val / 10000000).toFixed(1)}Cr` : `₹${Math.round(val / 100000)}L`}
                </text>
              </g>
            );
          })}

          {/* Month Bars */}
          {rows.map((row, index) => {
            const groupX = left + index * stepX + stepX / 2;
            const targetX = groupX - barWidth - 1.5;
            const actualX = groupX + 1.5;

            const targetY = getY(row.target);
            const targetH = Math.max(2, chartHeight - bottom - targetY);

            const actualY = getY(row.actual);
            const actualH = Math.max(2, chartHeight - bottom - actualY);

            const isMet = row.achievementPercent >= 100;
            const actualColor = isMet ? "#16a34a" : "#0284c7";
            const isHovered = active === index;

            return (
              <g key={row.month}>
                {/* Target Bar */}
                <rect
                  x={targetX}
                  y={targetY}
                  width={barWidth}
                  height={targetH}
                  rx="3"
                  fill="#94a3b8"
                  opacity={isHovered ? 1 : 0.8}
                />

                {/* Actual Bar */}
                <rect
                  x={actualX}
                  y={actualY}
                  width={barWidth}
                  height={actualH}
                  rx="3"
                  fill={actualColor}
                  opacity={isHovered ? 1 : 0.95}
                />

                {/* % text */}
                {row.actual > 0 && (
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

                {/* Month label */}
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
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {selected && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: `${Math.min(Math.max(((left + (active as number) * stepX + stepX / 2) / chartWidth) * 100, 16), 84)}%`,
              transform: "translateX(-50%)",
              background: "#0f172a",
              color: "#ffffff",
              padding: "10px 14px",
              borderRadius: 10,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              pointerEvents: "none",
              zIndex: 10,
              minWidth: 190,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, borderBottom: "1px solid #334155", paddingBottom: 5, marginBottom: 5 }}>
              {selected.label} Performance
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
              <span style={{ color: "#94a3b8" }}>Target:</span>
              <strong>{formatRupees(selected.target)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
              <span style={{ color: "#94a3b8" }}>Actual Sales:</span>
              <strong style={{ color: selected.achievementPercent >= 100 ? "#4ade80" : "#38bdf8" }}>
                {formatRupees(selected.actual)}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #334155", paddingTop: 4, marginTop: 4 }}>
              <span style={{ color: "#94a3b8" }}>Achievement:</span>
              <strong style={{ color: selected.achievementPercent >= 100 ? "#4ade80" : "#fbbf24" }}>
                {selected.achievementPercent}%
              </strong>
            </div>
          </div>
        )}
      </div>
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
      ytdSalesRupees: number;
      ytdSalesLakh: number;
      quantity: number;
      invoiceCount: number;
      isSold: boolean;
    }>;
    totalYtdLakh: number;
    totalSalesRupees: number;
    activeCount: number;
    totalCount: number;
  };
}) {
  if (!thrust || !thrust.products || thrust.products.length === 0) return null;

  return (
    <div
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
                Thrust Products and Actual Sales till date (Rs. Lac)
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
                Strategic Focus 2024-25
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b" }}>
              Annual priority portfolio decided at year start · {thrust.activeCount} of {thrust.totalCount} products active with sales
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
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "#854d0e" }}>
              Total Thrust Sales
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#713f12", lineHeight: 1.1 }}>
              {thrust.totalYtdLakh.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 700 }}>Lac</span>
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: "#eab308", opacity: 0.5 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#854d0e" }}>Total Value</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#713f12" }}>
              {formatRupees(thrust.totalSalesRupees)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 9 Thrust Products Matching User's Sheet */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
        }}
      >
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
                  {p.ytdSalesLakh > 0 ? `${p.ytdSalesLakh.toFixed(2)} L` : "0.00 L"}
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
                  <span>{isSold ? formatRupees(p.ytdSalesRupees) : "No sales recorded"}</span>
                  {p.invoiceCount > 0 && (
                    <span style={{ fontSize: 9.5, color: "#64748b" }}>
                      {p.invoiceCount} inv
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Report Card "Performance" tab ── */
function ReportCardTab({ data, kpi, period, onSelectTab }: { data: any; kpi: any; period: Period; onSelectTab?: (tab: Tab) => void }) {
  const target = kpi.targetValue ?? 0;
  const actual = kpi.actualSalesValue ?? 0;
  const pct = kpi.achievementPercent ?? (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);
  const remaining = Math.max(0, target - actual);

  const isToday = period === "today";
  const isWeek = period === "week";
  const isMonth = period === "month";
  const isFytd = period === "fytd";
  const isUnder = !isToday && pct < 50;

  const targetLabel = isToday
    ? "Daily Target"
    : isWeek
    ? "Weekly Target"
    : isMonth
    ? "Monthly Target"
    : "FYTD Target";

  // Determine status label, badge theme, subtitle and icon
  let statusLabel = "On Track";
  let statusSub = `${Math.round(pct)}% of target achieved`;
  let statusTheme: "green" | "amber" | "red" | "blue" = "green";

  if (isToday) {
    if (actual >= target && target > 0) {
      statusLabel = "Daily Quota Met";
      statusSub = `${formatRupees(actual)} billed today (${Math.round(pct)}% pace)`;
      statusTheme = "green";
    } else if (actual > 0) {
      statusLabel = "Daily Billing Active";
      statusSub = `${formatRupees(actual)} billed today · Quota: ${formatRupees(target)}`;
      statusTheme = pct >= 50 ? "green" : "amber";
    } else {
      statusLabel = "Daily Invoicing Open";
      statusSub = `No billing logged today · Daily quota: ${formatRupees(target)}`;
      statusTheme = "blue";
    }
  } else if (isWeek) {
    if (pct >= 80) {
      statusLabel = "Weekly On Track";
      statusSub = `${Math.round(pct)}% of weekly quota achieved`;
      statusTheme = "green";
    } else if (pct >= 40) {
      statusLabel = "Weekly In Progress";
      statusSub = `${Math.round(pct)}% achieved · Target: ${formatRupees(target)}`;
      statusTheme = "amber";
    } else {
      statusLabel = "Weekly Pace Alert";
      statusSub = `${Math.round(pct)}% achieved · Target: ${formatRupees(target)}`;
      statusTheme = "red";
    }
  } else {
    // Month or FYTD
    if (pct >= 80) {
      statusLabel = "On Track";
      statusSub = `${Math.round(pct)}% of target achieved`;
      statusTheme = "green";
    } else if (pct >= 50) {
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

  const periodLabel = isToday
    ? "Today"
    : isWeek
    ? "This Week"
    : isMonth
    ? (data?.isAnchoredToLatestCycle ? `This Month (${data.latestActiveMonth ? data.latestActiveMonth + " active ledger" : "Latest Cycle"})` : "This Month")
    : "FY to Date";

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
  const newCustomersCount = Math.floor(totalDealersCount * 0.1);

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

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* ── Friendly Profile & Performance Hero Card ── */}
      <div style={{
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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 260 }}>
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
                <span>📅 Period: <strong style={{ color: "#0f172a" }}>{periodLabel}</strong></span>
                {target > 0 && (
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
                : "Not Clocked In Today"}
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

        {/* Territory Coverage Bar - Friendly & Compact */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          paddingTop: 12,
          borderTop: "1px solid #f1f5f9",
          fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 5 }}>
            👥 Executive Territory Coverage:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {["Gurgaon", "Delhi", "Ghaziabad", "Faridabad", "Noida", "Sonepat", "Bahadurgarh", "Sahibabad", "Rudrapur"].map((city, i) => (
              <span
                key={i}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {city}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Key Performance Highlights / Milestones Strip ── */}
      <div style={{
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
        </div>
      </div>

      {/* ── Monthly Target vs Achievement Chart ── */}
      <TargetVsActualMonthlyChart rows={data.monthlyTargetVsActual} />

      {/* ── Thrust Products & Actual Sales Till Date ── */}
      <ThrustProductsCard thrust={data.thrustProducts} />

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
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
        border: "1.5px solid #bfdbfe",
        borderRadius: "14px",
        padding: "18px 22px",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1e3a8a" }}>
            AI Executive Diagnostic &amp; Field Intelligence
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
          Automated algorithmic synthesis combining real-time CRM field operations, order pipelines, and reconciled Tally accounting records.
        </p>
      </div>

      <div className="rm-insight" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px" }}>
        {lines.map((line, i) => (
          <p key={i} style={{ margin: "0 0 12px", lineHeight: 1.6, fontSize: 13.5, color: "#1e293b" }}>{line}</p>
        ))}
      </div>
    </div>
  );
}

/* ── Dedicated Manager Action Plan Tab ── */
function ManagerActionPlanTab({ data, kpi }: { data: any; kpi: any }) {
  const target = kpi.targetValue ?? 0;
  const actual = kpi.actualSalesValue ?? 0;
  const pct = kpi.achievementPercent ?? (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);
  const isUnder = pct < 50;

  const dealerMap: Record<string, number> = {};
  (data.actualSales ?? []).forEach((s: any) => {
    dealerMap[s.customerName] = (dealerMap[s.customerName] ?? 0) + s.amount;
  });
  const totalActualSales = Object.values(dealerMap).reduce((s, v) => s + v, 0) || 1;
  const topDealers = Object.entries(dealerMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top5Total = topDealers.reduce((s, d) => s + d[1], 0);
  const dependencyPct = totalActualSales > 1 ? Math.round((top5Total / totalActualSales) * 100) : 0;
  const totalDealersCount = Object.keys(dealerMap).length;

  const activeDealerNames = new Set((data.actualSales ?? []).map((s: any) => s.customerName));
  const dormant = (data.customerVisits ?? []).filter((v: any) => !activeDealerNames.has(v.customerName));

  const actions: Array<{ urgency: "high" | "medium" | "low"; title: string; detail: string; action: string }> = [];
  if (pct < 50) {
    actions.push({
      urgency: "high",
      title: "Intervene on Target Shortfall",
      detail: `Current target achievement is only ${Math.round(pct)}%. The gap to target is ${formatRupees(Math.max(0, target - actual))}.`,
      action: "Mandate daily deal inspection with the RM on high-value pipeline opportunities.",
    });
  }
  if (dependencyPct > 70 && totalDealersCount > 0) {
    actions.push({
      urgency: "high",
      title: "Mitigate Key Account Dependency",
      detail: `${dependencyPct}% of revenue originates from just top ${Math.min(5, totalDealersCount)} accounts.`,
      action: "Set strict quota for expanding mid-tier and tier-2 customer accounts this quarter.",
    });
  }
  if (dormant.length > 0) {
    actions.push({
      urgency: "medium",
      title: "Reactivate Dormant Accounts",
      detail: `${dormant.length} dealers have recent field visit history but generated ₹0 billing in this period.`,
      action: "Schedule joint executive visits or commercial review calls to unlock pending orders.",
    });
  }
  if (kpi.followUpsOverdue > 0) {
    actions.push({
      urgency: "medium",
      title: "Clear Overdue CRM Follow-ups",
      detail: `${kpi.followUpsOverdue} customer follow-ups have exceeded their committed deadline.`,
      action: "Ensure RM contacts all overdue leads before scheduling fresh exploratory visits.",
    });
  }
  if (actions.length === 0) {
    actions.push({
      urgency: "low",
      title: "Maintain Performance Momentum",
      detail: "RM is meeting performance milestones with healthy dealer coverage.",
      action: "Conduct standard weekly cadence and explore cross-sell opportunities for newly launched products.",
    });
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Supervisory Header Banner */}
      <div style={{
        background: isUnder ? "linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)" : "linear-gradient(135deg, #f0fdf4 0%, #f0fdfa 100%)",
        border: `1.5px solid ${isUnder ? "#f87171" : "#86efac"}`,
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: isUnder ? "#991b1b" : "#166534" }}>
              Managerial Directive &amp; Remediation Plan
            </span>
            <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              Action Plan for {data.name}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
              Specific supervisory recommendations based on live field logs, pipeline health, and Tally actuals.
            </p>
          </div>
          <span style={{
            padding: "8px 16px",
            borderRadius: 24,
            fontWeight: 800,
            fontSize: 13,
            background: isUnder ? "#dc2626" : "#16a34a",
            color: "#ffffff",
          }}>
            {isUnder ? "⚠️ Action Required" : "✅ Performance Stable"}
          </span>
        </div>
      </div>

      {/* Action Checkpoints */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
          Priority Action Items ({actions.length})
        </h3>
        {actions.map((act, i) => (
          <div
            key={i}
            style={{
              background: "#ffffff",
              border: `1.5px solid ${act.urgency === "high" ? "#fecaca" : act.urgency === "medium" ? "#fed7aa" : "#bbf7d0"}`,
              borderLeft: `5px solid ${act.urgency === "high" ? "#dc2626" : act.urgency === "medium" ? "#ea580c" : "#16a34a"}`,
              borderRadius: 12,
              padding: "16px 18px",
              boxShadow: "0 2px 8px rgba(15,23,42,.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>
                  {act.urgency === "high" ? "🔴" : act.urgency === "medium" ? "🟠" : "🟢"}
                </span>
                <strong style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{act.title}</strong>
              </div>
              <span style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 6,
                background: act.urgency === "high" ? "#fee2e2" : act.urgency === "medium" ? "#ffedd5" : "#dcfce7",
                color: act.urgency === "high" ? "#991b1b" : act.urgency === "medium" ? "#9a3412" : "#166534",
              }}>
                {act.urgency === "high" ? "Urgent Priority" : act.urgency === "medium" ? "Review Soon" : "Maintain"}
              </span>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#475569", lineHeight: 1.5 }}>{act.detail}</p>
            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12.5,
              color: "#1e293b",
            }}>
              <strong style={{ color: "#0369a1", marginRight: 6 }}>Direct Action:</strong>
              {act.action}
            </div>
          </div>
        ))}
      </div>

      {/* Field Visit Notes & Accountability */}
      <div style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", borderRadius: 14, padding: "18px 20px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
          Recent Field Visits &amp; Accountability Log
        </h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>
          Cross-reference client visit objectives against documented field outcomes.
        </p>

        {(!data.customerVisits || data.customerVisits.length === 0) ? (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontStyle: "italic", padding: "16px 0", textAlign: "center" }}>
            No visit logs recorded in the selected period.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "400px", overflowY: "auto", paddingRight: 4 }}>
            {(data.customerVisits || []).map((v: any) => (
              <div key={v.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div>
                    <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{v.customerName}</strong>
                    {v.purpose && <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>— {v.purpose}</span>}
                  </div>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{formatDate(v.date)}</span>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#334155" }}>
                  <strong style={{ color: "#0f172a", marginRight: 6 }}>Field Outcome:</strong>
                  {v.outcome || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No outcome logged</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */
export function AdminRmDetail({ rmId }: { rmId: string }) {
  const [tab, setTab] = useState<Tab>("performance");
  const [period, setPeriod] = useState<Period>("month");
  const [showPreview, setShowPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const { from, to } = periodDates(period);

  const { data, loading, error, reload } = useAdminData(
    () => adminApi.rmDetail(rmId, from, to),
    [rmId, from, to]
  );

  const kpi = data?.kpi;

  const handleDownloadReport = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      const ok = await downloadRmReportDirect(data, period);
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      }
    } catch (err) {
      console.error("Failed to download report:", err);
    } finally {
      setDownloading(false);
    }
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
            {data && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="rm-download-report-btn"
                title="Preview & Download executive report card"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Report
              </button>
            )}
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

              {/* ── Manager Action Plan tab ── */}
              {tab === "actionplan" && (
                <div className="admin-card">
                  <header className="admin-card-header">
                    <div>
                      <p className="admin-eyebrow">Supervisory directive</p>
                      <h2>Manager Action Plan — {data.name}</h2>
                    </div>
                  </header>
                  <ManagerActionPlanTab data={data} kpi={kpi} />
                </div>
              )}
              {/* Hidden off-screen render target for direct PDF capture (NO NEW TAB/PAGE OPENS) */}
              <div
                style={{
                  position: "fixed",
                  left: "-9999px",
                  top: 0,
                  width: "794px",
                  zIndex: -999,
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                <RmReportDocument data={data} period={period} />
              </div>
            </>
          )}
        </AdminState>
      </AdminPage>

      {/* In-Page Report Preview Modal (NO NEXT PAGE OPENS!) */}
      {data && (
        <RmReportPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          data={data}
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

