"use client";
import { useEffect, useState } from "react";
import { rmApi } from "@/lib/api";
import { formatRupees, formatNumber } from "@/lib/format";
import { VoiceMicButton } from "@/components/common/voice-mic-button";

export function RmCustomers() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    rmApi.customers(q, page)
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [q, page]);

  function openCustomer(c: any) {
    if (selected?.id === c.id) { setSelected(null); setDetail(null); return; }
    setSelected(c); setDetail(null); setDetailLoading(true);
    rmApi.customerDetail(c.id).then(setDetail).finally(() => setDetailLoading(false));
  }

  return (
    <div className="admin-content">
      <section className="admin-page">
        <header className="admin-page-header">
          <div className="admin-page-heading">
            <p className="admin-eyebrow">Regional Manager</p>
            <h1>Customer Database</h1>
            <p className="admin-page-description">{total} customers assigned to your team.</p>
          </div>
        </header>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", border: "1px solid var(--color-border, #cbd5e1)", borderRadius: "8px", padding: "0 0.5rem", background: "var(--color-surface, #ffffff)" }}>
          <input
            className="admin-search"
            placeholder="Search customers…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent" }}
          />
          <VoiceMicButton onTranscript={(text) => { setQ(text); setPage(0); }} />
        </div>
        {loading ? <div className="admin-placeholder">Loading…</div> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Customer</th><th>Type</th><th>City</th><th className="numeric">Total Sales</th><th className="numeric">Outstanding</th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <>
                    <tr key={c.id} onClick={() => openCustomer(c)} style={{ cursor: "pointer" }}>
                      <td><strong className="admin-cell-title">{c.name}</strong></td>
                      <td>{c.type ?? "—"}</td>
                      <td>{c.city ?? "—"}</td>
                      <td className="numeric">{formatRupees(c.totalSales)}</td>
                      <td className="numeric">{formatRupees(c.outstanding)}</td>
                    </tr>
                    {selected?.id === c.id && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={5} style={{ padding: "1rem", background: "var(--color-surface-2)" }}>
                          {detailLoading ? <div>Loading detail…</div> : detail && (
                            <div>
                              <p><strong>GSTIN:</strong> {detail.customer?.gstin ?? "—"} &nbsp; <strong>Phone:</strong> {detail.customer?.phone ?? "—"} &nbsp; <strong>Email:</strong> {detail.customer?.email ?? "—"}</p>
                              <p><strong>Recent visits:</strong> {detail.visits?.length ?? 0}</p>
                              {detail.visits?.slice(0, 3).map((v: any) => (
                                <div key={v.id} style={{ fontSize: "0.8rem", color: "var(--color-text-2)" }}>
                                  {v.business_date} — {v.purpose} ({v.status})
                                </div>
                              ))}
                              <p style={{ marginTop: "0.5rem" }}><strong>Recent activities:</strong> {detail.activities?.length ?? 0}</p>
                              {detail.activities?.slice(0, 3).map((a: any) => (
                                <div key={a.id} style={{ fontSize: "0.8rem", color: "var(--color-text-2)" }}>
                                  {a.activity_type} — {a.subject}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", alignItems: "center" }}>
          <button className="admin-button" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-2)" }}>Page {page + 1} · {total} total</span>
          <button className="admin-button" disabled={(page + 1) * 50 >= total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </section>
    </div>
  );
}
