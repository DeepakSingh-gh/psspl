"use client";
import { useEffect, useState } from "react";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatNumber, formatPeriod, formatRupees } from "@/lib/format";
import { VoiceMicButton } from "@/components/common/voice-mic-button";
import type { ProductDetail } from "@/types/admin";

const PAGE_SIZE = 50;

export function AdminProducts() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setTerm(search); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useAdminData(
    () => adminApi.products({ search: term, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [term, page]
  );

  const total = data?.total ?? 0;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <AdminPage
      eyebrow="Master data"
      title="Products"
      description="The live Tally item master, refreshed whenever the connector completes a sync."
      actions={
        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--color-border, #cbd5e1)", borderRadius: "8px", padding: "0 0.4rem", background: "var(--color-surface, #ffffff)" }}>
          <span className="admin-sr-only">Search products</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product name" type="search" style={{ border: "none", outline: "none", background: "transparent" }} />
          <VoiceMicButton onTranscript={(text) => setSearch(text)} />
        </div>
      }
    >
      <div className="admin-filters">
        <p className="admin-result-count">{formatNumber(total)} products</p>
      </div>

      <AdminState loading={loading} error={error} onRetry={reload} empty={!data?.items.length}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="numeric">Rate</th>
                <th className="numeric">Quantity</th>
                <th className="numeric">Value</th>
                <th className="numeric">Months sold</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong className="admin-cell-title">{product.name}</strong>
                    {(product.packingSize || product.uom) && <small>{[product.packingSize, product.uom].filter(Boolean).join(" · ")}</small>}
                  </td>
                  <td className="numeric">{formatRupees(product.rate)}</td>
                  <td className="numeric">{formatNumber(product.totalQuantity)}</td>
                  <td className="numeric">{formatRupees(product.totalValue)}</td>
                  <td className="numeric">{formatNumber(product.frequency)}</td>
                  <td className="numeric"><button type="button" className="admin-button ghost small" onClick={() => setSelected(product.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="admin-pager">
            <button type="button" className="admin-button ghost small" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {page + 1} of {pages}</span>
            <button type="button" className="admin-button ghost small" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </AdminState>

      {selected && <ProductDrawer id={selected} onClose={() => setSelected(null)} />}
    </AdminPage>
  );
}

function ProductDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error, reload } = useAdminData<ProductDetail>(() => adminApi.product(id), [id]);
  const peak = Math.max(1, ...(data?.monthly ?? []).map((row) => row.quantity));

  return (
    <div className="admin-drawer" role="dialog" aria-modal="true" aria-label="Product detail">
      <button type="button" className="admin-drawer-scrim" onClick={onClose} aria-label="Close" />
      <div className="admin-drawer-panel">
        <header>
          <div>
            <p className="admin-eyebrow">Product</p>
            <h2>{data?.product.name ?? "Loading…"}</h2>
          </div>
          <button type="button" className="admin-button ghost small" onClick={onClose}>Close</button>
        </header>

        <AdminState loading={loading} error={error} onRetry={reload}>
          {data && (
            <>
              <dl className="admin-definition">
                <div><dt>Rate</dt><dd>{formatRupees(data.product.rate)}</dd></div>
                <div><dt>Quantity sold</dt><dd>{formatNumber(data.product.totalQuantity)}</dd></div>
                <div><dt>Lifetime value</dt><dd>{formatRupees(data.product.totalValue)}</dd></div>
                <div><dt>Months with sales</dt><dd>{formatNumber(data.product.frequency)}</dd></div>
              </dl>

              <section>
                <h3>Monthly quantity</h3>
                {data.monthly.length === 0 ? <p className="admin-note subtle">No monthly breakdown was imported for this product.</p> : (
                  <ul className="admin-bars">
                    {data.monthly.map((row) => (
                      <li key={row.period}>
                        <span className="admin-bar-label">{formatPeriod(row.period)}</span>
                        <span className="admin-bar"><span style={{ width: `${Math.max((row.quantity / peak) * 100, row.quantity > 0 ? 2 : 0)}%` }} /></span>
                        <span className="admin-bar-value">{formatNumber(row.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3>Sales by regional manager</h3>
                {data.byRm.length === 0 ? <p className="admin-note subtle">This product does not appear in the RM sales ledger.</p> : (
                  <table className="admin-table compact">
                    <thead><tr><th>Manager</th><th>Year</th><th className="numeric">Quantity</th><th className="numeric">Value</th></tr></thead>
                    <tbody>
                      {data.byRm.map((row, index) => (
                        <tr key={`${row.rmName}-${row.financialYear}-${index}`}>
                          <td>{row.rmName}</td>
                          <td>{row.financialYear}</td>
                          <td className="numeric">{formatNumber(row.quantity)}</td>
                          <td className="numeric">{formatRupees(row.salesValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {data.product.sourceFile && <p className="admin-note subtle">Source: {data.product.sourceFile}</p>}
            </>
          )}
        </AdminState>
      </div>
    </div>
  );
}
