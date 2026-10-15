"use client";

import React from "react";

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

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/* ─────────────────────────────────────────────────────────────
   Report Component for Direct PDF Generation
   Strict 2-Page Executive Layout (A4: 794px × 1123px per page)
───────────────────────────────────────────────────────────── */
export function RmReportDocument({ data, period }: { data: any; period?: string }) {
  if (!data) return null;

  const kpi      = data.kpi ?? {};
  const target   = kpi.targetValue       ?? 0;
  const actual   = kpi.actualSalesValue  ?? 0;
  const pct      = target > 0 ? Math.min(999, Math.round((actual / target) * 100)) : 0;
  const gap      = target - actual;

  const statusLabel =
    pct >= 100 ? "Target Exceeded 🏆" :
    pct >= 80  ? "On Track ✅" :
    pct >= 50  ? "Moderate Pace 🟡" :
                 "Needs Attention 🔴";

  const statusColor =
    pct >= 80 ? "#16a34a" :
    pct >= 50 ? "#d97706" :
                "#dc2626";

  const statusBg =
    pct >= 80 ? "#dcfce7" :
    pct >= 50 ? "#fef3c7" :
                "#fee2e2";

  // Top customers
  const dealerMap: Record<string, number> = {};
  (data.actualSales ?? []).forEach((s: any) => {
    if (s.amount > 0) dealerMap[s.customerName] = (dealerMap[s.customerName] ?? 0) + s.amount;
  });
  const topCustomers = Object.entries(dealerMap).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const totalSales   = topCustomers.reduce((s, [, v]) => s + v, 0) || 1;

  // Top products
  const topProducts  = (data.topProducts ?? []).filter((p: any) => p.salesValue > 0).slice(0, 7);
  const productTotal = topProducts.reduce((s: number, p: any) => s + p.salesValue, 0) || 1;

  // Field data
  const recentVisits  = (data.customerVisits ?? []).slice(0, 4);
  const openFollowUps = (data.followUps ?? []).filter((f: any) => !f.completedAt).slice(0, 4);

  const periodLabel =
    period === "today" ? "Today" :
    period === "week"  ? "This Week" :
    period === "fytd"  ? "FYTD" :
    "This Month";

  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  /* ── AI Insights synthesis ── */
  const topProduct = data.topProducts?.[0];
  const overdueCount = data.pipeline?.filter((p: any) => p.isOverdue).length ?? 0;
  const aiLines: string[] = [];

  aiLines.push(
    `${data.name} completed ${kpi.visitsCompleted ?? recentVisits.length} customer visits` +
    (kpi.customersCovered > 0 ? `, covering ${kpi.customersCovered} unique accounts` : "") +
    ` during the ${periodLabel.toLowerCase()} period.`
  );

  if ((kpi.expectedOrdersValue ?? 0) > 0 || actual > 0) {
    aiLines.push(
      `The RM generated ${fmt(kpi.expectedOrdersValue ?? 0)} in expected orders, while actual billed sales stand at ${fmt(actual)}.`
    );
  }

  if (topProduct && topProduct.salesValue > 0) {
    aiLines.push(`${topProduct.name} is the strongest revenue product, contributing ${fmt(topProduct.salesValue)}.`);
  }

  const concerns: string[] = [];
  if (pct < 50) {
    concerns.push(`target achievement is low at ${Math.round(pct)}%`);
  }
  if ((kpi.followUpsOpen ?? openFollowUps.length) > 0) {
    const fCount = kpi.followUpsOpen ?? openFollowUps.length;
    concerns.push(`${fCount} follow-up${fCount > 1 ? "s" : ""} remain open`);
  }
  if (overdueCount > 0) {
    concerns.push(`${overdueCount} pipeline order${overdueCount > 1 ? "s" : ""} are overdue`);
  }

  if (concerns.length > 0) {
    aiLines.push(`Key areas for review: ${concerns.join("; ")}.`);
    aiLines.push("Management directive: Prioritize overdue customer touchpoints and accelerate pipeline conversion.");
  } else {
    aiLines.push("Sales velocity is robust. Maintain cadence and explore cross-sell opportunities across dormant accounts.");
  }

  /* ── Manager Action Plan calculation ── */
  const isUnder = pct < 50;
  const totalActualSales = Object.values(dealerMap).reduce((s, v) => s + v, 0) || 1;
  const topDealers = Object.entries(dealerMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top5Total = topDealers.reduce((s, d) => s + d[1], 0);
  const dependencyPct = totalActualSales > 1 ? Math.round((top5Total / totalActualSales) * 100) : 0;
  const totalDealersCount = Object.keys(dealerMap).length;

  const activeDealerNames = new Set((data.actualSales ?? []).map((s: any) => s.customerName));
  const dormant = (data.customerVisits ?? []).filter((v: any) => !activeDealerNames.has(v.customerName));

  const actionItems: Array<{ urgency: "URGENT PRIORITY" | "REVIEW SOON" | "STANDARD CADENCE"; title: string; detail: string; action: string; color: string }> = [];

  if (pct < 50) {
    actionItems.push({
      urgency: "URGENT PRIORITY",
      title: "Intervene on Target Shortfall",
      detail: `Current target achievement is ${Math.round(pct)}%. Revenue gap to quota is ${fmt(Math.max(0, target - actual))}.`,
      action: "Mandate daily deal inspection with the RM on high-value pipeline opportunities.",
      color: "#dc2626",
    });
  }
  if (dependencyPct > 70 && totalDealersCount > 0) {
    actionItems.push({
      urgency: "URGENT PRIORITY",
      title: "Mitigate Key Account Dependency",
      detail: `${dependencyPct}% of revenue originates from just top ${Math.min(5, totalDealersCount)} accounts.`,
      action: "Set strict quota for expanding mid-tier and tier-2 customer accounts this quarter.",
      color: "#dc2626",
    });
  }
  if (dormant.length > 0) {
    actionItems.push({
      urgency: "REVIEW SOON",
      title: "Reactivate Dormant Accounts",
      detail: `${dormant.length} dealers have recent field visits but logged ₹0 billing this period.`,
      action: "Schedule joint executive visits or commercial review calls to unlock pending orders.",
      color: "#d97706",
    });
  }
  if ((kpi.followUpsOverdue ?? 0) > 0 || openFollowUps.length > 0) {
    actionItems.push({
      urgency: "REVIEW SOON",
      title: "Clear Overdue CRM Follow-ups",
      detail: `${openFollowUps.length} follow-ups require scheduled customer interaction.`,
      action: "Ensure RM contacts all pending leads before scheduling fresh exploratory visits.",
      color: "#d97706",
    });
  }
  if (actionItems.length === 0) {
    actionItems.push({
      urgency: "STANDARD CADENCE",
      title: "Maintain Performance Momentum",
      detail: "RM is meeting performance milestones with healthy dealer coverage.",
      action: "Conduct standard weekly cadence and explore cross-sell opportunities for newly launched products.",
      color: "#16a34a",
    });
  }

  // Limit to top 2-3 most critical items to guarantee crisp fit on Page 2
  const topActions = actionItems.slice(0, 3);

  // ── Monthly Target vs Actual Graph Calculations for Page 1 ──
  const monthlyRows: Array<{ month: string; label: string; target: number; actual: number; achievementPercent: number }> =
    data.monthlyTargetVsActual ?? [];
  const chartW = 730;
  const chartH = 92;
  const cLeft = 46;
  const cRight = 14;
  const cTop = 14;
  const cBottom = 20;
  const plotW = chartW - cLeft - cRight;
  const plotH = chartH - cTop - cBottom;
  const maxVal = monthlyRows.reduce((m, r) => Math.max(m, r.target || 0, r.actual || 0), 0) || 100000;
  const ceiling = Math.ceil(maxVal / 100000) * 100000 || 100000;
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
         PAGE 1: SALES & PERFORMANCE OVERVIEW (Exact A4 1122px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        id="rm-report-page-1"
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
                📅 Report Cycle: <strong>{periodLabel}</strong> ({new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })})
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
                {Math.round(pct)}%
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

          {/* ── KPI GRID (8 Metrics) ── */}
          <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#003a5c", marginBottom: "6px" }}>
            Key Performance Indicators
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "Target Quota", val: fmt(target), icon: "🎯", bg: "#dbeafe", sub: "Period quota", col: "#0f172a" },
              { label: "Actual Sales", val: fmt(actual), icon: "💰", bg: "#dcfce7", sub: "Billed in Tally", col: "#16a34a" },
              { label: gap > 0 ? "Gap to Target" : "Surplus", val: gap > 0 ? fmt(gap) : `+${fmt(Math.abs(gap))}`, icon: gap > 0 ? "📉" : "🏆", bg: gap > 0 ? "#fef3c7" : "#dcfce7", sub: gap > 0 ? "Shortfall" : "Surplus pace", col: gap > 0 ? "#d97706" : "#16a34a" },
              { label: "Achievement %", val: `${Math.round(pct)}%`, icon: "⚡", bg: "#f1f5f9", sub: "Quota ratio", col: statusColor },
              { label: "Active Customers", val: topCustomers.length, icon: "🤝", bg: "#ede9fe", sub: "Billed accounts", col: "#0f172a" },
              { label: "Customer Visits", val: kpi.visitsCompleted ?? recentVisits.length, icon: "🏪", bg: "#fce7f3", sub: "Visits logged", col: "#0f172a" },
              { label: "Open Follow-ups", val: openFollowUps.length, icon: "📋", bg: openFollowUps.length > 0 ? "#fee2e2" : "#dcfce7", sub: "Pending action", col: openFollowUps.length > 0 ? "#dc2626" : "#16a34a" },
              { label: "Products Sold", val: topProducts.length, icon: "📦", bg: "#dcfce7", sub: "Distinct SKUs", col: "#0f172a" },
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

          {/* ── 📈 IMPACTFUL MONTHLY TARGET VS ACHIEVEMENT DUAL-BAR GRAPH ── */}
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
                <strong style={{ fontSize: "10.5px", color: "#0f172a" }}>Monthly Sales Target vs Achievement Trend</strong>
                <span style={{ fontSize: "9px", color: "#64748b" }}>· 12-Month Financial Year Quota Trajectory</span>
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

            {/* SVG Visual Graph */}
            {monthlyRows.length > 0 ? (
              <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: "94px", display: "block" }}>
                {/* Horizontal reference grid lines */}
                {[0, 0.5, 1].map((ratio) => {
                  const val = ceiling * ratio;
                  const yPos = chartH - cBottom - ratio * plotH;
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
                        {val >= 10000000 ? `₹${(val / 10000000).toFixed(1)}Cr` : val >= 100000 ? `₹${Math.round(val / 100000)}L` : "₹0"}
                      </text>
                    </g>
                  );
                })}

                {/* Bars for all months */}
                {monthlyRows.map((row, idx) => {
                  const groupX = cLeft + idx * stepX + stepX / 2;
                  const targetX = groupX - barW - 1;
                  const actualX = groupX + 1;

                  const targetH = Math.max(2, (row.target / ceiling) * plotH);
                  const targetY = chartH - cBottom - targetH;

                  const actualH = Math.max(2, (row.actual / ceiling) * plotH);
                  const actualY = chartH - cBottom - actualH;

                  const isMet = row.achievementPercent >= 100;
                  const actualColor = isMet ? "#16a34a" : "#0284c7";

                  return (
                    <g key={row.month || idx}>
                      {/* Target bar */}
                      <rect
                        x={targetX}
                        y={targetY}
                        width={barW}
                        height={targetH}
                        rx="2"
                        fill="#cbd5e1"
                      />

                      {/* Actual bar */}
                      <rect
                        x={actualX}
                        y={actualY}
                        width={barW}
                        height={actualH}
                        rx="2"
                        fill={actualColor}
                      />

                      {/* % text above actual bar for active billing */}
                      {row.actual > 0 && (
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

                      {/* Month label at bottom */}
                      <text
                        x={groupX}
                        y={chartH - 4}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="600"
                        fill="#64748b"
                      >
                        {row.label.split(" ")[0]}
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
                  <span>Target: <strong>{fmt(target)}</strong></span>
                  <span>Achieved: <strong style={{ color: "#16a34a" }}>{fmt(actual)}</strong></span>
                  <span>{gap > 0 ? "Shortfall: " : "Surplus: "}<strong style={{ color: gap > 0 ? "#dc2626" : "#16a34a" }}>{gap > 0 ? fmt(gap) : `+${fmt(Math.abs(gap))}`}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* ── TWO COLUMN: TOP CUSTOMERS & TOP PRODUCTS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            {/* Top Customers */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                🤝 Top Customers ({topCustomers.length})
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
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "14px 0", fontSize: "10px" }}>No customer sales data</div>
              )}
            </div>

            {/* Top Products */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                📦 Top Products ({topProducts.length})
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
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "14px 0", fontSize: "10px" }}>No product sales data</div>
              )}
            </div>
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
          <div>Page 1 of 2 · Confidential · Generated {generatedAt}</div>
        </div>
      </div>

      {/* ── Visual separator between Page 1 and Page 2 in preview ── */}
      <div style={{ height: "24px", backgroundColor: "#1e293b" }} />

      {/* ══════════════════════════════════════════════════════════════
         PAGE 2: AI INSIGHT & MANAGER ACTION PLAN (Exact A4 1122px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        id="rm-report-page-2"
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
        <div>
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
            <div>
              <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#38bdf8" }}>
                SECTION 2: STRATEGIC INTELLIGENCE &amp; SUPERVISORY ACTION
              </div>
              <strong style={{ fontSize: "14px", color: "#ffffff" }}>{data.name} — AI Insight &amp; Manager Action Plan</strong>
            </div>
            <div style={{ textAlign: "right", fontSize: "9.5px", color: "rgba(255,255,255,0.8)" }}>
              RM Code: <strong>{data.rmCode || "075709"}</strong> · {periodLabel}
            </div>
          </div>

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
                    AI Executive Diagnostic &amp; Field Intelligence
                  </h3>
                  <div style={{ fontSize: "9px", color: "#3b82f6" }}>
                    Algorithmic synthesis combining CRM field activity, order pipelines, and reconciled Tally sales
                  </div>
                </div>
              </div>
              <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "99px", fontSize: "9px", fontWeight: 700 }}>
                AI Model Generated
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "10.5px", color: "#1e293b", lineHeight: 1.45 }}>
              {aiLines.map((line, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                  <span style={{ color: "#3b82f6", fontWeight: 800, fontSize: "12px" }}>•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
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
                  Managerial Directive &amp; Remediation Plan
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
                {isUnder ? "⚠️ Action Required" : "✅ Performance Stable"}
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
                    <strong>Direct Action:</strong> {item.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── TWO COLUMN: FIELD VISITS & OPEN FOLLOW-UPS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {/* Customer Visits */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                🏪 Recent Field Visits ({recentVisits.length})
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
                        {v.outcome || "No outcome logged"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: "12px 0", fontSize: "10px" }}>No visits recorded</div>
              )}
            </div>

            {/* Follow-ups */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "10px 12px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                📋 Open Follow-ups ({openFollowUps.length})
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
                  ✅ All follow-ups cleared
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
          <div>Page 2 of 2 · End of Executive Report</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Direct 2-Page PDF Downloader Function (NO BLANK PAGES, EXACTLY 2 PAGES!)
───────────────────────────────────────────────────────────── */
export async function downloadRmReportDirect(data: any, period?: string): Promise<boolean> {
  if (!data) return false;

  const page1El = document.getElementById("rm-report-page-1");
  const page2El = document.getElementById("rm-report-page-2");
  if (!page1El || !page2El) return false;

  const cleanName = (data.name || "RM").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${cleanName}_RM_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

  try {
    const { jsPDF } = await import("jspdf");
    const html2canvasModule = await import("html2canvas");
    const html2canvas = (html2canvasModule as any).default || html2canvasModule;

    // 1. Capture Page 1 to high-resolution canvas
    const canvas1 = await html2canvas(page1El, {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollY: 0,
    });

    // 2. Capture Page 2 to high-resolution canvas
    const canvas2 = await html2canvas(page2El, {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollY: 0,
    });

    // 3. Create strictly 2-page A4 PDF (210mm x 297mm per page)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // Page 1
    const img1 = canvas1.toDataURL("image/jpeg", 0.98);
    pdf.addImage(img1, "JPEG", 0, 0, 210, 297, undefined, "FAST");

    // Page 2
    pdf.addPage("a4", "portrait");
    const img2 = canvas2.toDataURL("image/jpeg", 0.98);
    pdf.addImage(img2, "JPEG", 0, 0, 210, 297, undefined, "FAST");

    // Save directly to user's downloads folder (GUARANTEED EXACTLY 2 PAGES!)
    pdf.save(fileName);
    return true;
  } catch (err) {
    console.error("Direct 2-page PDF generation failed:", err);
    return false;
  }
}


/* ─────────────────────────────────────────────────────────────
   In-Page Report Preview Modal (NO NEXT PAGE OPENS!)
───────────────────────────────────────────────────────────── */
export function RmReportPreviewModal({
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
    try {
      const ok = await downloadRmReportDirect(data, period);
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const periodLabel =
    period === "today" ? "Today" :
    period === "week"  ? "This Week" :
    period === "fytd"  ? "FYTD" :
    "This Month";

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
            End of 2-Page Executive Report · Click <strong>Download PDF</strong> above to save
          </div>
        </div>
      </div>
    </div>
  );
}
