"use client";
import { reportDateRange } from "@/lib/business-date";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { adminApi, authApi, clearSession } from "@/lib/api";
import "./print-report.css";

/* ─────────────────────────────────────
   Helpers
───────────────────────────────────── */
function fmt(val: number) {
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
function pctColor(pct: number) {
  if (pct >= 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

/* ─────────────────────────────────────
   Page
───────────────────────────────────── */
export default function RmPrintReport() {
  const { id }          = useParams<{ id: string }>();
  const router          = useRouter();
  const searchParams    = useSearchParams();

  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    authApi.me()
      .then(({ user }: any) => { if (user.role !== "admin") router.replace("/"); })
      .catch(() => { clearSession(); router.replace("/login"); });

    // Use passed date range or default to this month
    const defaults = reportDateRange("month");
    const from  = searchParams.get("from") || defaults.from;
    const to    = searchParams.get("to")   || defaults.to;

    adminApi.rmDetail(id, from, to)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

    // Inject clean @page style before printing to suppress browser URL/date headers
    let printStyle: HTMLStyleElement | null = null;
    const onBefore = () => {
      printStyle = document.createElement("style");
      printStyle.textContent = `
        @page { size: A4 portrait; margin: 8mm 10mm; }
        .print-controls { display: none !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      `;
      document.head.appendChild(printStyle);
    };
    const onAfter = () => { printStyle?.remove(); printStyle = null; };
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint",  onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint",  onAfter);
    };
  }, [id, router, searchParams]);

  /* ── Loading ── */
  if (loading) return (
    <div className="status-screen">
      <div style={{ fontSize: 40 }}>⏳</div>
      <div className="status-text">Generating Report…</div>
    </div>
  );

  /* ── Error ── */
  if (error || !data) return (
    <div className="status-screen" style={{ color: "#dc2626" }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div className="status-text">{error || "No report data found."}</div>
    </div>
  );

  /* ── Derived values ── */
  const kpi      = data.kpi ?? {};
  const target   = kpi.targetValue       ?? 0;
  const actual   = kpi.actualSalesValue  ?? 0;
  const pct      = target > 0 ? Math.min(999, Math.round((actual / target) * 100)) : 0;
  const gap      = target - actual;
  const colorCls = pctColor(pct);

  const statusLabel =
    pct >= 80 ? "On Track ✅" :
    pct >= 50 ? "Moderate Pace 🟡" :
                "Needs Attention 🔴";

  // Top customers (non-zero only)
  const dealerMap: Record<string, number> = {};
  (data.actualSales ?? []).forEach((s: any) => {
    if (s.amount > 0) dealerMap[s.customerName] = (dealerMap[s.customerName] ?? 0) + s.amount;
  });
  const topCustomers = Object.entries(dealerMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalSales   = topCustomers.reduce((s, [, v]) => s + v, 0) || 1;

  // Top products (non-zero only)
  const topProducts  = (data.topProducts ?? []).filter((p: any) => p.salesValue > 0).slice(0, 8);
  const productTotal = topProducts.reduce((s: number, p: any) => s + p.salesValue, 0) || 1;

  // Field data
  const recentVisits  = (data.customerVisits ?? []).slice(0, 6);
  const openFollowUps = (data.followUps ?? []).filter((f: any) => !f.completedAt).slice(0, 6);

  const hasCustomers = topCustomers.length > 0;
  const hasProducts  = topProducts.length > 0;
  const hasVisits    = recentVisits.length > 0;
  const hasFollowUps = openFollowUps.length > 0;

  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      {/* ── Top Controls Bar — hidden on print ── */}
      <div className="print-controls">
        <div className="print-controls-brand">
          <span className="brand-dot" />
          PSSPL CRM · Executive RM Report
        </div>
        <div className="print-controls-actions">
          <span className="print-tip">
            💡 For clean PDF: More settings → uncheck "Headers and footers"
          </span>
          <button className="btn-back" onClick={() => router.back()}>← Back</button>
          <button className="btn-download" onClick={() => window.print()}>⬇ Download PDF</button>
        </div>
      </div>

      {/* ── Report Body ── */}
      <div className="report-body">

        {/* COVER */}
        <div className="report-cover">
          <div className="cover-left">
            <div className="cover-brand">Progressive Surface Systems Pvt. Ltd. · CRM Intelligence</div>
            <h1 className="cover-name">{data.name}</h1>
            <div className="cover-badges">
              {data.rmCode       && <span className="cover-badge">RM Code: {data.rmCode}</span>}
              {data.region       && <span className="cover-badge">📍 {data.region}</span>}
              {data.operatingFrom && <span className="cover-badge">🏢 {data.operatingFrom}</span>}
            </div>
            <div className="cover-period">
              📅 Report Period — {new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}
            </div>
          </div>
          <div className="cover-right">
            <div className="cover-pct-label">Achievement</div>
            <div className={`cover-pct ${colorCls}`}>{Math.round(pct)}%</div>
            <div className={`cover-status ${colorCls}`}>{statusLabel}</div>
            <div className="cover-gen">Generated {generatedAt}</div>
          </div>
        </div>

        {/* KPI SECTION */}
        <div className="section-title">Key Performance Indicators</div>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#dbeafe" }}>🎯</div>
            <div className="kpi-label">Monthly Target</div>
            <div className="kpi-value">{fmt(target)}</div>
            <div className="kpi-sub">Current period quota</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#dcfce7" }}>💰</div>
            <div className="kpi-label">Actual Sales</div>
            <div className="kpi-value" style={{ color: "#16a34a" }}>{fmt(actual)}</div>
            <div className="kpi-sub">Billed this period</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: gap > 0 ? "#fef3c7" : "#dcfce7" }}>
              {gap > 0 ? "📉" : "🏆"}
            </div>
            <div className="kpi-label">{gap > 0 ? "Gap to Close" : "Surplus"}</div>
            <div className="kpi-value" style={{ color: gap > 0 ? "#d97706" : "#16a34a" }}>
              {gap > 0 ? fmt(gap) : `+${fmt(Math.abs(gap))}`}
            </div>
            <div className="kpi-sub">{gap > 0 ? "Remaining to target" : "Exceeded target"}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#f1f5f9" }}>⚡</div>
            <div className="kpi-label">Achievement %</div>
            <div className="kpi-value" style={{ color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626" }}>
              {Math.round(pct)}%
            </div>
            <div className="kpi-sub">vs. monthly target</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#ede9fe" }}>🤝</div>
            <div className="kpi-label">Active Customers</div>
            <div className="kpi-value">{topCustomers.length}</div>
            <div className="kpi-sub">Billed this period</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#fce7f3" }}>🏪</div>
            <div className="kpi-label">Customer Visits</div>
            <div className="kpi-value">{kpi.visitsCompleted ?? recentVisits.length}</div>
            <div className="kpi-sub">Visits logged</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: openFollowUps.length > 0 ? "#fee2e2" : "#dcfce7" }}>📋</div>
            <div className="kpi-label">Open Follow-ups</div>
            <div className="kpi-value" style={{ color: openFollowUps.length > 0 ? "#dc2626" : "#16a34a" }}>
              {kpi.followUpsOpen ?? openFollowUps.length}
            </div>
            <div className="kpi-sub">Actions pending</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "#dcfce7" }}>📦</div>
            <div className="kpi-label">Products Sold</div>
            <div className="kpi-value">{topProducts.length}</div>
            <div className="kpi-sub">Distinct SKUs</div>
          </div>
        </div>

        {/* TARGET VS ACTUAL */}
        <div className="section-title">Target vs Actual Achievement</div>
        <div className="target-hero">
          <div className="target-hero-top">
            <div>
              <div className="target-hero-title">Monthly Sales Performance</div>
              <div className="target-hero-sub">{fmt(actual)} achieved out of {fmt(target)} target</div>
            </div>
            <div className="target-hero-pct" style={{ color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626" }}>
              {Math.round(pct)}%
            </div>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${colorCls}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="target-meta-row">
            <div className="target-meta-item">
              <div className="meta-label">🎯 Target</div>
              <div className="meta-value">{fmt(target)}</div>
            </div>
            <div className="target-meta-item">
              <div className="meta-label">✅ Achieved</div>
              <div className="meta-value" style={{ color: "#16a34a" }}>{fmt(actual)}</div>
            </div>
            <div className="target-meta-item">
              <div className="meta-label">{gap > 0 ? "📉 Gap" : "🏆 Surplus"}</div>
              <div className="meta-value" style={{ color: gap > 0 ? "#dc2626" : "#16a34a" }}>
                {gap > 0 ? fmt(gap) : `+${fmt(Math.abs(gap))}`}
              </div>
            </div>
          </div>
        </div>

        {/* SALES BREAKDOWN — only when there's data */}
        {(hasCustomers || hasProducts) && (
          <>
            <div className="section-title">Sales Breakdown</div>
            <div className="two-col">
              <div className="card-box">
                <div className="card-box-title">🤝 Top Customers</div>
                {hasCustomers ? (
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Customer</th><th className="num">Sales</th><th className="num">Share</th></tr></thead>
                    <tbody>
                      {topCustomers.map(([name, val], i) => {
                        const sp = Math.round((val / totalSales) * 100);
                        return (
                          <tr key={name}>
                            <td className="muted" style={{ width: 22 }}>{i + 1}</td>
                            <td className="bold">{name}</td>
                            <td className="num green">{fmt(val)}</td>
                            <td className="num">
                              <span className="bar-mini" style={{ width: `${Math.max(3, sp * 0.5)}px`, background: i === 0 ? "#0284c7" : "#cbd5e1" }} />
                              {" "}{sp}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state">No sales data this period</div>
                )}
              </div>

              <div className="card-box">
                <div className="card-box-title">📦 Top Products</div>
                {hasProducts ? (
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Product</th><th className="num">Sales</th><th className="num">Share</th></tr></thead>
                    <tbody>
                      {topProducts.map((p: any, i: number) => {
                        const sp = Math.round((p.salesValue / productTotal) * 100);
                        return (
                          <tr key={p.name}>
                            <td className="muted" style={{ width: 22 }}>{i + 1}</td>
                            <td className="bold" style={{ fontSize: 11 }}>{p.name}</td>
                            <td className="num green">{fmt(p.salesValue)}</td>
                            <td className="num">
                              <span className="bar-mini" style={{ width: `${Math.max(3, sp * 0.5)}px`, background: i === 0 ? "#16a34a" : "#cbd5e1" }} />
                              {" "}{sp}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state">No product data this period</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* FIELD ACTIVITY — only when there's data */}
        {(hasVisits || hasFollowUps) && (
          <>
            <div className="section-title">Field Activity</div>
            <div className="two-col">
              <div className="card-box">
                <div className="card-box-title">🏪 Recent Customer Visits</div>
                {hasVisits ? recentVisits.map((v: any) => (
                  <div className="visit-item" key={v.id}>
                    <div className="visit-top">
                      <span className="visit-customer">{v.customerName}</span>
                      <span className="visit-date">{fmtDate(v.date)}</span>
                    </div>
                    <div className={`visit-outcome${!v.outcome ? " empty" : ""}`}>
                      {v.outcome || "No outcome logged"}
                    </div>
                  </div>
                )) : <div className="empty-state">No visits this period</div>}
              </div>

              <div className="card-box">
                <div className="card-box-title">📋 Open Follow-ups</div>
                {hasFollowUps ? (
                  <table className="data-table">
                    <thead><tr><th>Title</th><th>Due</th><th>Priority</th></tr></thead>
                    <tbody>
                      {openFollowUps.map((f: any) => (
                        <tr key={f.id}>
                          <td style={{ fontSize: 11 }}>
                            <strong>{f.title}</strong>
                            {f.customerName && <><br /><span style={{ color: "#64748b", fontSize: 10 }}>{f.customerName}</span></>}
                          </td>
                          <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(f.dueDate)}</td>
                          <td>
                            <span className={`pill ${f.priority === "high" ? "pill-red" : f.priority === "medium" ? "pill-amber" : "pill-gray"}`}>
                              {f.priority ?? "normal"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className="empty-state" style={{ color: "#16a34a" }}>✅ All follow-ups cleared</div>}
              </div>
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="report-footer">
          <div className="footer-left">
            <strong>PSSPL CRM</strong> · {data.name}
            {data.rmCode && <span className="pill pill-blue" style={{ marginLeft: 8 }}>RM {data.rmCode}</span>}
          </div>
          <div>Confidential · Generated {generatedAt}</div>
        </div>

      </div>
    </>
  );
}
