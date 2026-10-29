"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rmApi, authApi, clearSession } from "@/lib/api";
import type { RmFeedbackSnapshot } from "@/types/rm-feedback";
import { achievementPercent } from "../../../../shared/achievement.mjs";
import "./print.css";

const MONTHS = ["Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export default function PrintReport() {
  const router = useRouter();
  const [data, setData] = useState<RmFeedbackSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authApi.me()
      .then(({ user }) => { if (user.role !== "rm") router.replace("/"); })
      .catch(() => { clearSession(); router.replace("/login"); });

    rmApi.printReport()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Generating Report...</div>;
  if (error) return <div style={{ padding: 40, color: "red", fontFamily: "sans-serif" }}>Error: {error}</div>;
  if (!data) return null;

  const monthlyMetrics = data.monthlyMetrics;
  const weeklyPurchases = data.weeklySummary;
  const prevYearData = data.previousYearPerformance;
  const fmt = (value: number | null) => value == null ? "-" : value.toFixed(2);
  const team = Array.from({ length: 9 }, (_, index) => data.teamEntries[index]);

  return (
    <div className="print-report-container" style={{ maxWidth: "1280px", margin: "0 auto", padding: "16px 24px" }}>
      <div className="controls" style={{ marginBottom: "16px" }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 20px", background: "#007CBA", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}
        >
          🖨️ Print PDF / Export
        </button>
      </div>

      {/* Header Block matching PDF layout */}
      <table style={{ width: "100%", border: "2px solid #000", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td colSpan={2} style={{ background: "#fef08a", fontWeight: 800, fontSize: "11pt", textAlign: "center", border: "1px solid #000", padding: "8px" }}>
              PSSPL REGIONAL MANAGER SALES TARGET FEED BACK SUPPORT
            </td>
            <td style={{ background: "#fef08a", fontWeight: 800, textAlign: "center", border: "1px solid #000", width: "90px" }}>
              {data.reportDate}
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "120px" }}>
              Regional Manager
            </td>
            <td style={{ fontWeight: 800, fontSize: "11pt", border: "1px solid #000", width: "130px" }}>
              {data.rm.name}
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "80px" }}>
              RM Code
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "80px" }}>
              {data.rm.rmCode}
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "110px" }}>
              Operating from: City
            </td>
            <td style={{ fontWeight: 800, fontSize: "10.5pt", border: "1px solid #000", width: "110px" }}>
              {data.rm.operatingFrom}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Target for Territory Expansion & Revenue Targets Grid */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ width: "18%", fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              Target for Territory Expansion - Cities
            </td>
            <td style={{ width: "10%", border: "1px solid #000", padding: "6px", fontSize: "9pt" }}>
              {data.territoryExpansion.targetExpansionCities}
            </td>
            <td style={{ width: "10%", border: "1px solid #000", padding: "6px", fontSize: "9pt" }}>

            </td>
            <td style={{ width: "10%", border: "1px solid #000", padding: "6px", fontSize: "9pt" }}>

            </td>
            <td style={{ width: "15%", border: "1px solid #000" }}></td>
            <td rowSpan={2} style={{ width: "5%", background: "#f8fafc", fontWeight: 700, fontSize: "8pt", textAlign: "center", border: "1px solid #000", padding: "2px" }}>
              Current Year<br />Revenue Targets<br />Rs. L
            </td>
            <td style={{ width: "10%", fontWeight: 700, textAlign: "center", border: "1px solid #000" }}>Annual Target</td>
            <td style={{ width: "10%", fontWeight: 700, textAlign: "center", border: "1px solid #000" }}>Target till Month</td>
            <td style={{ width: "8%", fontWeight: 700, textAlign: "center", border: "1px solid #000" }}>Actual Total</td>
            <td style={{ width: "6%", fontWeight: 700, textAlign: "center", border: "1px solid #000" }}>% Actual</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              Visits made to new Territory
            </td>
            <td colSpan={4} style={{ border: "1px solid #000" }}></td>
            <td style={{ fontWeight: 800, textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>{fmt(data.annual.currentYearTarget)}</td>
            <td style={{ fontWeight: 800, textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>{fmt(data.annual.currentYearTargetTillMonth)}</td>
            <td style={{ fontWeight: 800, textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>{fmt(data.annual.currentYearActual)}</td>
            <td style={{ fontWeight: 800, textAlign: "center", color: "#b91c1c", border: "1px solid #000" }}>{data.annual.currentYearPct}%</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              New Dealer or Customer appointed in new territory this year
            </td>
            <td colSpan={4} style={{ border: "1px solid #000", padding: "6px", fontWeight: 600 }}>
              {data.territoryExpansion.newDealersText}
            </td>
            <td style={{ fontWeight: 700, fontSize: "8.5pt", border: "1px solid #000", textAlign: "center" }}>
              Business Registrat'n<br />form Yes/No
            </td>
            <td style={{ fontWeight: 700, textAlign: "center", border: "1px solid #000" }}>{data.rm.businessRegistrationForm ?? "-"}</td>
            <td colSpan={3} style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 8px", fontSize: "9pt" }}>
              {data.rm.registrationCodes.join(" / ")}
            </td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border: "none" }}></td>
            <td style={{ background: "#f8fafc", fontWeight: 700, fontSize: "8pt", textAlign: "center", border: "1px solid #000", padding: "2px" }}>
              Last Year<br />Rs. L
            </td>
            <td style={{ textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>{fmt(data.annual.lastYearTarget)}</td>
            <td style={{ textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>{fmt(data.annual.lastYearTargetTillMonth)}</td>
            <td style={{ textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>{fmt(data.annual.lastYearActual)}</td>
            <td style={{ textAlign: "center", color: "#b91c1c", fontWeight: 700, border: "1px solid #000" }}>{data.annual.lastYearPct}%</td>
          </tr>
        </tbody>
      </table>

      {/* Team Mates & Existing Sales Territory: Cities */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ width: "15%", fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              Team Mates ,<br />Sales Executives
            </td>
            {team.map((member, index) => <td key={index} style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>{member?.name ?? ""}</td>)}
            <td style={{ width: "8%", border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700, background: "#f8fafc" }}>Tech Serv<br />Center</td>
            <td style={{ width: "10%", border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700 }}>{data.technicalService.center}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              Existing Sales Territory<br />: Cities
            </td>
            {team.map((member, index) => <td key={index} style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>{member?.citiesCovered ?? ""}</td>)}
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700, background: "#f8fafc" }}>Tech Serv<br />Executive</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700 }}>{data.technicalService.executive}</td>
          </tr>
        </tbody>
      </table>

      {/* Thrust Products and Actual Sales Grid */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse", marginBottom: 0 }}><tbody>
        {data.thrustProductGroups.map((group: any, index: number) => <tr key={index}>
          {index === 0 && <td rowSpan={2} style={{ width: "12%", border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: 700, fontSize: "8.5pt" }}>{fmt(data.thrustTotalLakh)}<br />Thrust Products and Actual Sales till date<br />Rs. Lac</td>}
          <td style={{ border: "1px solid #000", padding: 6, fontSize: "8pt", fontWeight: 700 }}>Thrust Product / YTD Sales Rs.L</td>
          <td style={{ border: "1px solid #000", padding: 6, fontSize: "8.5pt", whiteSpace: "pre-wrap" }}>{group.productsText}</td>
          <td style={{ border: "1px solid #000", padding: 6, fontSize: "8.5pt", whiteSpace: "pre-wrap" }}>{group.achievedText || "-"}</td>
        </tr>)}
      </tbody></table>

      {/* Visual Chart: Monthly Sales Target Vs Achievement */}
      <div style={{ border: "2px solid #000", borderTop: "none", padding: "12px 16px", background: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: 6 }}>Monthly Sales Target Vs Achievement</div>
        <div style={{ display: "flex", alignItems: "flex-end", height: "160px", gap: "10px", padding: "10px 0 5px" }}>
          {monthlyMetrics.map((m, i) => {
            const maxVal = Math.max(1, ...monthlyMetrics.map((month: any) => Math.max(month.target ?? 0, month.achieved ?? 0)));
            const targetHeight = `${((m.target ?? 0) / maxVal) * 100}%`;
            const achievedHeight = m.achieved !== null ? `${(m.achieved / maxVal) * 100}%` : "0%";
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "100%", width: "100%", justifyContent: "center" }}>
                  <div style={{ width: "45%", height: targetHeight, background: "#94a3b8", borderRadius: "1px 1px 0 0", position: "relative" }}>
                    <span style={{ position: "absolute", top: "-13px", fontSize: "6.5pt", width: "100%", textAlign: "center" }}>{fmt(m.target)}</span>
                  </div>
                  {m.achieved !== null && (
                    <div style={{ width: "45%", height: achievedHeight, background: "#0284c7", borderRadius: "1px 1px 0 0", position: "relative" }}>
                      <span style={{ position: "absolute", top: "-13px", fontSize: "6.5pt", width: "100%", textAlign: "center", fontWeight: "bold" }}>{m.achieved.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "7.5pt", marginTop: "4px", fontWeight: 600 }}>{m.month}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "20px", fontSize: "8.5pt", justifyContent: "center", marginTop: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{ width: "10px", height: "10px", background: "#94a3b8" }}></div> Series 1: Target</div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{ width: "10px", height: "10px", background: "#0284c7" }}></div> Series 7: Achieved</div>
        </div>
      </div>

      {/* Target vs Achievement Monthly Numbers Grid matching PDF Page 2 */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse", marginBottom: 0 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th style={{ width: "12%", border: "1px solid #000", padding: "5px" }}>Metric</th>
            <th style={{ width: "8%", textAlign: "right", border: "1px solid #000", padding: "5px" }}>Total</th>
            {MONTHS.map(m => <th key={m} style={{ textAlign: "right", border: "1px solid #000", padding: "5px", fontSize: "8.5pt" }}>{m}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Target</td>
            <td style={{ textAlign: "right", fontWeight: 800, border: "1px solid #000", padding: "4px" }}>{fmt(data.monthlyTotals.target)}</td>
            {monthlyMetrics.map((m, i) => <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt" }}>{fmt(m.target)}</td>)}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Achieved</td>
            <td style={{ textAlign: "right", fontWeight: 800, border: "1px solid #000", padding: "4px" }}>{fmt(data.monthlyTotals.achieved)}</td>
            {monthlyMetrics.map((m, i) => (
              <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt", fontWeight: m.achieved !== null ? 700 : 400 }}>
                {m.achieved !== null ? m.achieved.toFixed(2) : "-"}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>% Achievement</td>
            <td style={{ textAlign: "right", fontWeight: 800, color: "#b91c1c", border: "1px solid #000", padding: "4px" }}>{data.monthlyTotals.pct}%</td>
            {monthlyMetrics.map((m, i) => {
              const percent = achievementPercent(m.achieved, m.target);
              const text = percent == null ? "-" : `${percent}%`;
              const color = (percent ?? 0) >= 90 ? "#15803d" : (percent ?? 0) >= 40 ? "#b45309" : "#b91c1c";
              return (
                <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt", fontWeight: 700, color }}>
                  {text}
                </td>
              );
            })}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Variation</td>
            <td style={{ textAlign: "right", fontWeight: 800, color: "#b91c1c", border: "1px solid #000", padding: "4px" }}>{fmt(data.monthlyTotals.variation)}</td>
            {monthlyMetrics.map((m, i) => (
              <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt", color: (m.variation ?? 0) < 0 ? "#b91c1c" : "#475569" }}>
                {m.variation !== 0 ? fmt(m.variation) : "0.00"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Purchases Weekly Target vs Achieved Table matching PDF Page 2 */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse", marginBottom: 0 }}>
        <thead>
          <tr style={{ background: "#fef08a" }}>
            <th style={{ width: "12%", border: "1px solid #000", padding: "5px" }}>Purchases</th>
            <th style={{ width: "8%", textAlign: "right", border: "1px solid #000", padding: "5px" }}>Total Rs.L</th>
            {MONTHS.map(m => <th key={m} style={{ textAlign: "right", border: "1px solid #000", padding: "5px", fontSize: "8.5pt" }}>{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {weeklyPurchases.map((wp, idx) => (
            <>
              <tr key={`t-${idx}`}>
                <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>{wp.weekLabel} Target</td>
                <td style={{ textAlign: "right", fontWeight: 700, border: "1px solid #000", padding: "4px" }}>{fmt(wp.targetTotal)}</td>
                {wp.targets.map((val, mi) => (
                  <td key={mi} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8pt" }}>{fmt(val)}</td>
                ))}
              </tr>
              <tr key={`a-${idx}`} style={{ background: "#f8fafc" }}>
                <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>{wp.weekLabel} Achieved</td>
                <td style={{ textAlign: "right", fontWeight: 800, border: "1px solid #000", padding: "4px" }}>{fmt(wp.achievedTotal)}</td>
                {wp.achieved.map((val, mi) => (
                  <td key={mi} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8pt", fontWeight: val !== null ? 700 : 400, color: val !== null ? (val > 10 ? "#15803d" : "#0f172a") : "#94a3b8" }}>
                    {val !== null ? val.toFixed(2) : ""}
                  </td>
                ))}
              </tr>
            </>
          ))}
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Special Targets</td>
            <td style={{ textAlign: "center", border: "1px solid #000" }}>-</td>
            {MONTHS.map(m => <td key={m} style={{ border: "1px solid #000" }}></td>)}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Achieved</td>
            <td style={{ textAlign: "center", border: "1px solid #000" }}>-</td>
            {MONTHS.map(m => <td key={m} style={{ border: "1px solid #000" }}></td>)}
          </tr>
        </tbody>
      </table>

      {/* Previous Year Table matching PDF */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ width: "12%", fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Previous year Target</td>
            <td style={{ width: "8%", textAlign: "right", fontWeight: 700, border: "1px solid #000", padding: "4px" }}>{fmt(data.annual.lastYearTarget)}</td>
            {prevYearData.map((d, i) => <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt" }}>{fmt(d.target)}</td>)}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Previous year Actual Sales</td>
            <td style={{ textAlign: "right", fontWeight: 700, border: "1px solid #000", padding: "4px" }}>{fmt(data.previousYearTotals.actual)}</td>
            {prevYearData.map((d, i) => <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt" }}>{fmt(d.actual)}</td>)}
          </tr>
        </tbody>
      </table>

    </div>
  );
}
