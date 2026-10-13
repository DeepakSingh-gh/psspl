"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rmApi, authApi, clearSession } from "@/lib/api";
import "./print.css";

const MONTHS = ["Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export default function PrintReport() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
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

  // Monthly Target vs Achievement data matching PDF Page 2
  const monthlyMetrics = [
    { month: "Apr", target: 37.58, achieved: 35.64, pct: 95, variation: -1.94 },
    { month: "May", target: 50.10, achieved: 7.64, pct: 15, variation: -42.46 },
    { month: "June", target: 41.75, achieved: 20.20, pct: 48, variation: -21.55 },
    { month: "July", target: 37.58, achieved: 7.89, pct: 21, variation: -29.68 },
    { month: "Aug", target: 41.75, achieved: 23.02, pct: 55, variation: -18.73 },
    { month: "Sep", target: 45.93, achieved: 19.85, pct: 43, variation: -26.08 },
    { month: "Oct", target: 45.93, achieved: null, pct: 0, variation: 0.00 },
    { month: "Nov", target: 37.58, achieved: null, pct: 0, variation: 0.00 },
    { month: "Dec", target: 33.40, achieved: null, pct: 0, variation: 0.00 },
    { month: "Jan", target: 37.58, achieved: null, pct: 0, variation: 0.00 },
    { month: "Feb", target: 41.75, achieved: null, pct: 0, variation: 0.00 },
    { month: "Mar", target: 50.10, achieved: null, pct: 0, variation: 0.00 },
  ];

  // Weekly Purchases breakdown matching PDF Page 2 exactly
  const weeklyPurchases = [
    {
      weekLabel: "Wk 1",
      targetTotal: 125.25,
      achievedTotal: 17.88,
      targets: [9.39, 12.53, 10.44, 9.39, 10.44, 11.48, 11.48, 9.39, 8.35, 9.39, 10.44, 12.53],
      achieved: [null, null, null, null, 13.72, 4.16, null, null, null, null, null, null],
    },
    {
      weekLabel: "Wk 2",
      targetTotal: 125.25,
      achievedTotal: 49.55,
      targets: [9.39, 12.53, 10.44, 9.39, 10.44, 11.48, 11.48, 9.39, 8.35, 9.39, 10.44, 12.53],
      achieved: [27.25, 1.01, 9.73, 2.35, 4.66, 4.55, null, null, null, null, null, null],
    },
    {
      weekLabel: "Wk 3",
      targetTotal: 125.25,
      achievedTotal: 12.67,
      targets: [9.39, 12.53, 10.44, 9.39, 10.44, 11.48, 11.48, 9.39, 8.35, 9.39, 10.44, 12.53],
      achieved: [4.15, 2.34, 4.11, null, 1.65, 0.42, null, null, null, null, null, null],
    },
    {
      weekLabel: "Wk 4",
      targetTotal: 125.25,
      achievedTotal: 34.14,
      targets: [9.39, 12.53, 10.44, 9.39, 10.44, 11.48, 11.48, 9.39, 8.35, 9.39, 10.44, 12.53],
      achieved: [4.24, 4.29, 6.36, 5.54, 2.99, 10.71, null, null, null, null, null, null],
    },
  ];

  // Previous year target vs actual
  const prevYearData = [
    { month: "Apr", target: 45.45, actual: 21.59 },
    { month: "May", target: 60.60, actual: 20.51 },
    { month: "June", target: 50.50, actual: 38.58 },
    { month: "July", target: 45.45, actual: 10.18 },
    { month: "Aug", target: 50.50, actual: 22.70 },
    { month: "Sep", target: 55.55, actual: 23.43 },
    { month: "Oct", target: 55.55, actual: 13.03 },
    { month: "Nov", target: 45.45, actual: 21.57 },
    { month: "Dec", target: 40.40, actual: 21.00 },
    { month: "Jan", target: 45.45, actual: 17.12 },
    { month: "Feb", target: 50.50, actual: 13.46 },
    { month: "Mar", target: 60.60, actual: 37.27 },
  ];

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
              30.09.2026
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "120px" }}>
              Regional Manager
            </td>
            <td style={{ fontWeight: 800, fontSize: "11pt", border: "1px solid #000", width: "130px" }}>
              Anil Jena
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "80px" }}>
              RM Code
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "80px" }}>
              075709
            </td>
            <td style={{ fontWeight: 700, border: "1px solid #000", width: "110px" }}>
              Operating from: City
            </td>
            <td style={{ fontWeight: 800, fontSize: "10.5pt", border: "1px solid #000", width: "110px" }}>
              Gurugram
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
              Deeper<br />Faridabad
            </td>
            <td style={{ width: "10%", border: "1px solid #000", padding: "6px", fontSize: "9pt" }}>
              Deeper<br />Noida
            </td>
            <td style={{ width: "10%", border: "1px solid #000", padding: "6px", fontSize: "9pt" }}>
              Deeper<br />Gurgaon
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
            <td style={{ fontWeight: 800, textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>501.00</td>
            <td style={{ fontWeight: 800, textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>254.68</td>
            <td style={{ fontWeight: 800, textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>114.24</td>
            <td style={{ fontWeight: 800, textAlign: "center", color: "#b91c1c", border: "1px solid #000" }}>45%</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              New Dealer or Customer appointed in new territory this year
            </td>
            <td colSpan={4} style={{ border: "1px solid #000", padding: "6px", fontWeight: 600 }}>
              1) Chem X Enterprises &nbsp;&nbsp;&nbsp; 2) S.B.Refractory
            </td>
            <td style={{ fontWeight: 700, fontSize: "8.5pt", border: "1px solid #000", textAlign: "center" }}>
              Business Registrat'n<br />form Yes/No
            </td>
            <td style={{ fontWeight: 700, textAlign: "center", border: "1px solid #000" }}>Yes</td>
            <td colSpan={3} style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 8px", fontSize: "9pt" }}>
              1) 2111C126<br />2) 2111S126
            </td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border: "none" }}></td>
            <td style={{ background: "#f8fafc", fontWeight: 700, fontSize: "8pt", textAlign: "center", border: "1px solid #000", padding: "2px" }}>
              Last Year<br />Rs. L
            </td>
            <td style={{ textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>606.00</td>
            <td style={{ textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>308.05</td>
            <td style={{ textAlign: "right", border: "1px solid #000", padding: "4px 8px" }}>136.98</td>
            <td style={{ textAlign: "center", color: "#b91c1c", fontWeight: 700, border: "1px solid #000" }}>44%</td>
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
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Sandeep<br />Kumar</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Sushil<br />Kumar</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Tika Prasad<br />Yadav</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Purshottam<br />Sarang</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Atal Trevidi</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Girand<br />Kumar</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Soumya<br />Das</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Prashant<br />Jadon</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 600 }}>Vikrant<br />Jadon</td>
            <td style={{ width: "8%", border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700, background: "#f8fafc" }}>Tech Serv<br />Center</td>
            <td style={{ width: "10%", border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700 }}>Gurugram</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "6px" }}>
              Existing Sales Territory<br />: Cities
            </td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Ghaziabad</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "7.5pt" }}>Delhi, Sonepat,<br />Bahadurgarh</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "7.5pt" }}>Delhi, Sonepat,<br />Bahadurgarh, Sahibabad</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Rudrapur</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Gurgaon</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Gurgaon</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Faridabad</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Gurgaon</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Noida</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700, background: "#f8fafc" }}>Tech Serv<br />Executive</td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontSize: "8.5pt", fontWeight: 700 }}>Girand Kumar</td>
          </tr>
        </tbody>
      </table>

      {/* Thrust Products and Actual Sales Grid */}
      <table style={{ width: "100%", border: "2px solid #000", borderTop: "none", borderCollapse: "collapse", marginBottom: 0 }}>
        <tbody>
          <tr>
            <td rowSpan={4} style={{ width: "12%", border: "1px solid #000", padding: "4px", textAlign: "center", fontWeight: 700, fontSize: "8.5pt" }}>
              <div style={{ fontWeight: 800, fontSize: "11pt", marginBottom: 4 }}>0.09</div>
              Thrust Products and Actual Sales till date<br />Rs. Lac
            </td>
            <td style={{ width: "8%", fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Thrust Product</td>
            <td style={{ width: "16%", fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Zpn Blue 15</td>
            <td style={{ width: "16%", fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Zpn 200</td>
            <td style={{ width: "16%", fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Zpn Black</td>
            <td style={{ width: "16%", fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Shimaclad Peony</td>
            <td style={{ width: "16%", fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Clearclad Lcbh</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "7.5pt" }}>YTD Sales Achieved Rs.L</td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000" }}></td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8pt" }}>Thrust Product</td>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Enilex Chorme Catalyst</td>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>POP</td>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Uviclad 612</td>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "8.5pt" }}>Patinas</td>
            <td style={{ border: "1px solid #000" }}></td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", textAlign: "center", fontSize: "7.5pt" }}>YTD Sales Achieved Rs.L</td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000" }}></td>
            <td style={{ border: "1px solid #000", textAlign: "center", fontWeight: 700, fontSize: "9pt" }}>0.09</td>
            <td style={{ border: "1px solid #000" }}></td>
          </tr>
        </tbody>
      </table>

      {/* Visual Chart: Monthly Sales Target Vs Achievement */}
      <div style={{ border: "2px solid #000", borderTop: "none", padding: "12px 16px", background: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: 6 }}>Monthly Sales Target Vs Achievement</div>
        <div style={{ display: "flex", alignItems: "flex-end", height: "160px", gap: "10px", padding: "10px 0 5px" }}>
          {monthlyMetrics.map((m, i) => {
            const maxVal = 60;
            const targetHeight = `${(m.target / maxVal) * 100}%`;
            const achievedHeight = m.achieved !== null ? `${(m.achieved / maxVal) * 100}%` : "0%";
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "100%", width: "100%", justifyContent: "center" }}>
                  <div style={{ width: "45%", height: targetHeight, background: "#94a3b8", borderRadius: "1px 1px 0 0", position: "relative" }}>
                    <span style={{ position: "absolute", top: "-13px", fontSize: "6.5pt", width: "100%", textAlign: "center" }}>{m.target.toFixed(2)}</span>
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
            <td style={{ textAlign: "right", fontWeight: 800, border: "1px solid #000", padding: "4px" }}>501.00</td>
            {monthlyMetrics.map((m, i) => <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt" }}>{m.target.toFixed(2)}</td>)}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Achieved</td>
            <td style={{ textAlign: "right", fontWeight: 800, border: "1px solid #000", padding: "4px" }}>114.24</td>
            {monthlyMetrics.map((m, i) => (
              <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt", fontWeight: m.achieved !== null ? 700 : 400 }}>
                {m.achieved !== null ? m.achieved.toFixed(2) : "-"}
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>% Achievement</td>
            <td style={{ textAlign: "right", fontWeight: 800, color: "#b91c1c", border: "1px solid #000", padding: "4px" }}>23%</td>
            {monthlyMetrics.map((m, i) => {
              const text = m.achieved !== null ? `${m.pct}%` : "0%";
              const color = m.pct >= 90 ? "#15803d" : m.pct >= 40 ? "#b45309" : "#b91c1c";
              return (
                <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt", fontWeight: 700, color }}>
                  {text}
                </td>
              );
            })}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Variation</td>
            <td style={{ textAlign: "right", fontWeight: 800, color: "#b91c1c", border: "1px solid #000", padding: "4px" }}>-140.44</td>
            {monthlyMetrics.map((m, i) => (
              <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt", color: m.variation < 0 ? "#b91c1c" : "#475569" }}>
                {m.variation !== 0 ? m.variation.toFixed(2) : "0.00"}
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
                <td style={{ textAlign: "right", fontWeight: 700, border: "1px solid #000", padding: "4px" }}>{wp.targetTotal.toFixed(2)}</td>
                {wp.targets.map((val, mi) => (
                  <td key={mi} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8pt" }}>{val.toFixed(2)}</td>
                ))}
              </tr>
              <tr key={`a-${idx}`} style={{ background: "#f8fafc" }}>
                <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>{wp.weekLabel} Achieved</td>
                <td style={{ textAlign: "right", fontWeight: 800, border: "1px solid #000", padding: "4px" }}>{wp.achievedTotal.toFixed(2)}</td>
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
            <td style={{ width: "8%", textAlign: "right", fontWeight: 700, border: "1px solid #000", padding: "4px" }}>606.00</td>
            {prevYearData.map((d, i) => <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt" }}>{d.target.toFixed(2)}</td>)}
          </tr>
          <tr>
            <td style={{ fontWeight: 700, border: "1px solid #000", padding: "4px 6px" }}>Previous year Actual Sales</td>
            <td style={{ textAlign: "right", fontWeight: 700, border: "1px solid #000", padding: "4px" }}>260.43</td>
            {prevYearData.map((d, i) => <td key={i} style={{ textAlign: "right", border: "1px solid #000", padding: "4px", fontSize: "8.5pt" }}>{d.actual.toFixed(2)}</td>)}
          </tr>
        </tbody>
      </table>

    </div>
  );
}
