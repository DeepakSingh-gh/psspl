"use client";
import { useEffect, useState } from "react";
import { rmApi } from "@/lib/api";
import { formatRupees, formatNumber } from "@/lib/format";

export function RmProductTrends() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    rmApi.productTrends()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-content">
      <section className="admin-page">
        <header className="admin-page-header">
          <div className="admin-page-heading">
            <p className="admin-eyebrow">Regional Manager</p>
            <h1>Product Trends</h1>
            <p className="admin-page-description">
              {data ? `Territory: ${data.territory || "All"} · ${data.from} to ${data.to}` : "Financial year to date"}
            </p>
          </div>
        </header>
        {error && <div className="admin-error">{error}</div>}
        {loading ? <div className="admin-placeholder">Loading product data…</div> : data && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th className="numeric">Sales Value</th>
                  <th className="numeric">Quantity</th>
                  <th className="numeric">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {data.trends?.length === 0 && (
                  <tr><td colSpan={5} className="admin-muted" style={{ textAlign: "center", padding: "2rem" }}>No product data yet — connect Tally to see trends.</td></tr>
                )}
                {data.trends?.map((t: any, i: number) => (
                  <tr key={t.name}>
                    <td style={{ color: "var(--color-text-2)", fontSize: "0.8rem" }}>{i + 1}</td>
                    <td><strong className="admin-cell-title">{t.name}</strong></td>
                    <td className="numeric">{formatRupees(t.salesValue)}</td>
                    <td className="numeric">{formatNumber(Math.round(t.quantity))}</td>
                    <td className="numeric">{formatNumber(t.invoiceCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
