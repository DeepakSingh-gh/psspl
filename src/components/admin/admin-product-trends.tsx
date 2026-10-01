"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatFinancialYear, formatNumber, formatPercent, formatRupees } from "@/lib/format";
import type { ProductTrendRow, TerritoryRow } from "@/types/admin";

type TrendView = "top" | "declining" | "slow";
type Grain = "month" | "quarter";

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });
const MONTH_LONG = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const asDate = (period: string) => { const [y, m] = period.split("-").map(Number); return new Date(y, m - 1, 1); };
const shortMonth = (period: string) => MONTH.format(asDate(period));
const longMonth = (period: string) => MONTH_LONG.format(asDate(period));

type Point = { key: string; label: string; title: string; current: number; previous: number; meta: string };

/* ========================================================================== */
/* Sales trend                                                                */
/* ========================================================================== */

function SalesTrend({ rows, grain }: {
  rows: Array<{ period: string; salesValue: number; previousSalesValue: number; invoiceCount: number; productCount: number }>;
  grain: Grain;
}) {
  const points: Point[] = useMemo(() => {
    if (grain === "month") {
      return rows.map((row) => ({
        key: row.period,
        label: shortMonth(row.period),
        title: longMonth(row.period),
        current: row.salesValue,
        previous: row.previousSalesValue,
        meta: `${formatNumber(row.productCount)} products · ${formatNumber(row.invoiceCount)} invoices`,
      }));
    }
    const buckets = new Map<string, Point>();
    for (const row of rows) {
      const month = Number(row.period.slice(5));
      const quarter = Math.floor(((month + 8) % 12) / 3) + 1; // Apr–Jun is Q1
      const key = `Q${quarter}`;
      const bucket = buckets.get(key) ?? { key, label: key, title: `Quarter ${quarter}`, current: 0, previous: 0, meta: "" };
      bucket.current += row.salesValue;
      bucket.previous += row.previousSalesValue;
      buckets.set(key, bucket);
    }
    return [...buckets.values()];
  }, [rows, grain]);

  const [active, setActive] = useState<string | null>(null);
  if (!points.length) return <p className="pi-empty">No sales in this period yet.</p>;

  const peak = Math.max(...points.flatMap((point) => [point.current, point.previous]), 1);
  const shown = active ? points.find((point) => point.key === active) ?? null : null;

  return (
    <div className="pi-chart">
      <div className="pi-chart-plot" onMouseLeave={() => setActive(null)}>
        {points.map((point) => {
          const growth = point.previous > 0 ? Math.round(((point.current - point.previous) / point.previous) * 100) : null;
          return (
            <div key={point.key} className={`pi-chart-col${active === point.key ? " is-active" : ""}`} onMouseEnter={() => setActive(point.key)}>
              <div className="pi-chart-bars">
                <span className="pi-bar is-previous" style={{ height: `${Math.max((point.previous / peak) * 100, 1)}%` }} />
                <span className="pi-bar is-current" style={{ height: `${Math.max((point.current / peak) * 100, 1)}%` }} />
              </div>
              <span className="pi-chart-label">{point.label}</span>
              {growth !== null && <span className={`pi-chart-delta ${growth >= 0 ? "is-up" : "is-down"}`}>{growth >= 0 ? "+" : ""}{growth}%</span>}
            </div>
          );
        })}

        {shown && (
          <div className="pi-tooltip" role="status">
            <strong>{shown.title}</strong>
            <span><i>Current</i>{formatRupees(shown.current)}</span>
            <span><i>Previous</i>{formatRupees(shown.previous)}</span>
            <span className={shown.current >= shown.previous ? "tone-positive" : "tone-negative"}>
              <i>Growth</i>
              {shown.previous > 0 ? `${shown.current >= shown.previous ? "+" : ""}${Math.round(((shown.current - shown.previous) / shown.previous) * 100)}%` : "new"}
            </span>
            {shown.meta && <small>{shown.meta}</small>}
          </div>
        )}
      </div>

      <div className="pi-chart-key">
        <span><i className="is-current" />Current year</span>
        <span><i className="is-previous" />Previous year</span>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Drawers                                                                    */
/* ========================================================================== */

function Drawer({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="admin-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="admin-drawer-scrim" onClick={onClose} aria-label="Close" />
      <div className="admin-drawer-panel">
        <header>
          <div><p className="admin-eyebrow">{eyebrow}</p><h2>{title}</h2></div>
          <button type="button" className="admin-button ghost small" onClick={onClose}>Close</button>
        </header>
        {children}
      </div>
    </div>
  );
}

function ProductDrawer({ product, onClose }: { product: ProductTrendRow; onClose: () => void }) {
  const peak = Math.max(product.salesValue, product.previousSalesValue, 1);
  return (
    <Drawer eyebrow="Product" title={product.name} onClose={onClose}>
      <div className="pi-drawer-head">
        <strong>{formatRupees(product.salesValue)}</strong>
        {product.growthPercent === null
          ? <span className="pi-chip is-new">New this period</span>
          : <span className={`pi-chip ${product.growthPercent >= 0 ? "is-up" : "is-down"}`}>{product.growthPercent >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(product.growthPercent))}</span>}
      </div>

      <section>
        <h3>Revenue</h3>
        <ul className="pi-compare">
          <li><span>Current period</span><span className="pi-compare-bar"><span style={{ width: `${(product.salesValue / peak) * 100}%` }} /></span><strong>{formatRupees(product.salesValue)}</strong></li>
          <li><span>Previous period</span><span className="pi-compare-bar is-muted"><span style={{ width: `${(product.previousSalesValue / peak) * 100}%` }} /></span><strong>{formatRupees(product.previousSalesValue)}</strong></li>
        </ul>
      </section>

      <dl className="admin-definition">
        <div><dt>Units</dt><dd>{formatNumber(product.quantity, 2)}</dd></div>
        <div><dt>Units last period</dt><dd>{formatNumber(product.previousQuantity ?? 0, 2)}</dd></div>
        <div><dt>Customers</dt><dd>{formatNumber(product.customerCount ?? 0)}</dd></div>
        <div><dt>Invoices</dt><dd>{formatNumber(product.invoiceCount)}</dd></div>
        {product.averageRate ? <div><dt>Average rate</dt><dd>{formatRupees(product.averageRate)}</dd></div> : null}
      </dl>

      <section>
        <h3>Territories</h3>
        {product.regions?.length
          ? <ul className="pi-mini-list">{product.regions.map((row) => (
            <li key={row.region}><span>{row.region}</span><strong>{formatRupees(row.salesValue)}</strong></li>
          ))}</ul>
          : <p className="admin-note subtle">No territory split for this product.</p>}
      </section>

      <Link className="admin-button" href="/admin/products">View full product list</Link>
    </Drawer>
  );
}

function TerritoryDrawer({ territory, onClose }: { territory: TerritoryRow; onClose: () => void }) {
  return (
    <Drawer eyebrow="Territory" title={territory.region} onClose={onClose}>
      <div className="pi-drawer-head">
        <strong>{formatRupees(territory.salesValue)}</strong>
        {territory.changePercent === null
          ? <span className="pi-chip is-new">No prior period</span>
          : <span className={`pi-chip ${territory.changePercent >= 0 ? "is-up" : "is-down"}`}>{territory.changePercent >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(territory.changePercent))}</span>}
      </div>

      <dl className="admin-definition">
        <div><dt>Previous period</dt><dd>{formatRupees(territory.previousSalesValue)}</dd></div>
        <div><dt>Share of sales</dt><dd>{territory.sharePercent === null ? "—" : `${territory.sharePercent}%`}</dd></div>
        <div><dt>Customers</dt><dd>{formatNumber(territory.customerCount)}</dd></div>
        <div><dt>Products sold</dt><dd>{formatNumber(territory.productCount)}</dd></div>
        <div><dt>Invoices</dt><dd>{formatNumber(territory.invoiceCount)}</dd></div>
      </dl>

      <section>
        <h3>Leading products</h3>
        {territory.topProducts.length
          ? <ul className="pi-mini-list">{territory.topProducts.map((row) => (
            <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(row.salesValue)}</strong></li>
          ))}</ul>
          : <p className="admin-note subtle">No products recorded.</p>}
      </section>

      <section>
        <h3>Top customers</h3>
        {territory.topCustomers.length
          ? <ul className="pi-mini-list">{territory.topCustomers.map((row) => (
            <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(row.salesValue)}</strong></li>
          ))}</ul>
          : <p className="admin-note subtle">No customers recorded.</p>}
      </section>

      <Link className="admin-button" href="/admin/team">View team performance</Link>
    </Drawer>
  );
}

/* ========================================================================== */
/* Page                                                                       */
/* ========================================================================== */

export function AdminProductTrends() {
  const [financialYear, setFinancialYear] = useState("");
  const [view, setView] = useState<TrendView>("top");
  const [grain, setGrain] = useState<Grain>("month");
  const [product, setProduct] = useState<ProductTrendRow | null>(null);
  const [territory, setTerritory] = useState<TerritoryRow | null>(null);

  const trends = useAdminData(() => adminApi.productTrends(financialYear || undefined), [financialYear]);
  const data = trends.data;
  const rows = (data?.[view] ?? []).slice(0, 6);

  const growthValue = data ? data.summary.totalSales - data.summary.previousTotalSales : 0;
  const peakMonth = data?.monthlyTrend.length
    ? data.monthlyTrend.reduce((best, row) => (row.salesValue > best.salesValue ? row : best), data.monthlyTrend[0])
    : null;

  /** Short statements, each built from a figure the API returned. */
  const changes = useMemo(() => {
    type Change = { key: string; direction: "up" | "down" | "flat"; title: string; detail: string };
    if (!data) return [] as Change[];
    const items: Change[] = [];
    for (const row of data.gainers.slice(0, 2)) {
      items.push({ key: `up-${row.name}`, direction: "up", title: row.name, detail: `+${formatRupees(Math.abs(row.changeValue ?? 0))} vs previous period` });
    }
    for (const row of data.losers.slice(0, 2)) {
      items.push({ key: `down-${row.name}`, direction: "down", title: row.name, detail: `−${formatRupees(Math.abs(row.changeValue ?? 0))}${row.growthPercent !== null ? ` · ${row.growthPercent}%` : ""}` });
    }
    if (data.newProducts.count) {
      items.push({ key: "new", direction: "flat", title: `${formatNumber(data.newProducts.count)} new products`, detail: `${formatRupees(data.newProducts.value)} billed for the first time` });
    }
    if (data.stoppedProducts.count) {
      items.push({ key: "stopped", direction: "flat", title: `${formatNumber(data.stoppedProducts.count)} products stopped`, detail: `${formatRupees(data.stoppedProducts.value)} sold last year, nothing this year` });
    }
    return items.slice(0, 5);
  }, [data]);

  const productPeak = Math.max(...rows.map((item) => item.salesValue), 1);
  const territoryPeak = Math.max(...(data?.territories ?? []).map((item) => item.salesValue), 1);

  return (
    <main className="pi">
      <header className="pi-header">
        <div>
          <p className="pi-eyebrow">Product intelligence</p>
          <h1>Product &amp; territory trends</h1>
          <p className="pi-sub">Live sales performance compared with the same period last year.</p>
        </div>
        <div className="pi-controls">
          {data?.financialYears.length ? (
            <label className="pi-select">
              <span>Financial year</span>
              <select value={financialYear || data.financialYear} onChange={(event) => setFinancialYear(event.target.value)}>
                {data.financialYears.map((year) => <option key={year} value={year}>{formatFinancialYear(year)}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </header>

      <AdminState loading={trends.loading} error={trends.error} onRetry={trends.reload} empty={false}>
        {data && <>
          <div className="pi-periods">
            <span className="pi-period is-current"><i />Current<strong>{formatDate(data.periodStart)} → {formatDate(data.periodEnd)}</strong></span>
            <span className="pi-period-vs">vs</span>
            <span className="pi-period"><i />Previous<strong>{formatDate(data.previousStart)} → {formatDate(data.previousEnd)}</strong></span>
          </div>

          <section className="pi-summary">
            <div className="pi-figure is-lead">
              <strong>{formatRupees(data.summary.totalSales)}</strong>
              <span>Current sales</span>
            </div>
            <div className="pi-figure">
              <strong className={data.summary.growthPercent === null ? "" : data.summary.growthPercent >= 0 ? "tone-positive" : "tone-negative"}>
                {data.summary.growthPercent === null ? "—" : `${data.summary.growthPercent >= 0 ? "+" : ""}${data.summary.growthPercent}%`}
              </strong>
              <span>Growth</span>
            </div>
            <div className="pi-figure">
              <strong className={growthValue >= 0 ? "tone-positive" : "tone-negative"}>{growthValue >= 0 ? "+" : "−"}{formatRupees(Math.abs(growthValue))}</strong>
              <span>Increment</span>
            </div>
            <div className="pi-figure">
              <strong>{formatRupees(data.summary.previousTotalSales)}</strong>
              <span>Previous period</span>
            </div>
            <div className="pi-figure">
              <strong>{formatNumber(data.summary.decliningProducts)}</strong>
              <span>Need attention</span>
            </div>
          </section>

          <div className="pi-grid">
            <section className="pi-panel pi-span-8">
              <header className="pi-panel-head">
                <div>
                  <h2>Sales trend</h2>
                  <p>Current year vs previous year</p>
                </div>
                <div className="pi-toggle" role="group" aria-label="Chart grain">
                  <button type="button" className={grain === "month" ? "is-on" : ""} onClick={() => setGrain("month")}>Monthly</button>
                  <button type="button" className={grain === "quarter" ? "is-on" : ""} onClick={() => setGrain("quarter")}>Quarterly</button>
                </div>
              </header>
              <SalesTrend rows={data.monthlyTrend} grain={grain} />
              <footer className="pi-panel-foot">
                {peakMonth && <span>Highest month <strong>{longMonth(peakMonth.period).split(" ")[0]} · {formatRupees(peakMonth.salesValue)}</strong></span>}
                <span>Current YTD <strong>{formatRupees(data.summary.totalSales)}</strong></span>
              </footer>
            </section>

            <section className="pi-panel pi-span-4">
              <header className="pi-panel-head"><div><h2>What changed</h2><p>Against the same period last year</p></div></header>
              {changes.length ? (
                <ul className="pi-changes">
                  {changes.map((item) => (
                    <li key={item.key} className={`is-${item.direction}`}>
                      <i aria-hidden="true">{item.direction === "up" ? "↑" : item.direction === "down" ? "↓" : "•"}</i>
                      <div><strong title={item.title}>{item.title}</strong><small>{item.detail}</small></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="pi-empty">Nothing moved materially in this period.</p>}
            </section>
          </div>

          <div className="pi-grid">
            <section className="pi-block pi-span-7">
              <header className="pi-block-head">
                <h2>Product performance</h2>
                <Link className="pi-link" href="/admin/products">View all products →</Link>
              </header>
              <div className="pi-tabs" role="tablist">
                {([["top", "Top selling"], ["declining", "Declining"], ["slow", "Low selling"]] as Array<[TrendView, string]>).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "is-on" : ""} onClick={() => setView(id)}>{label}</button>
                ))}
              </div>
              {rows.length ? (
                <ul className="pi-products">
                  {rows.map((row) => (
                    <li key={row.name}>
                      <button type="button" onClick={() => setProduct(row)}>
                        <span className="pi-product-name" title={row.name}>{row.name}</span>
                        <span className="pi-product-value">{formatRupees(row.salesValue)}</span>
                        <span className="pi-product-bar"><span style={{ width: `${Math.max((row.salesValue / productPeak) * 100, 2)}%` }} /></span>
                        <span className={`pi-product-change ${row.growthPercent === null ? "is-new" : row.growthPercent >= 0 ? "is-up" : "is-down"}`}>
                          {row.growthPercent === null ? "new" : `${row.growthPercent >= 0 ? "↑" : "↓"} ${Math.abs(row.growthPercent)}%`}
                        </span>
                        <span className="pi-product-units">{formatNumber(row.quantity, 0)} units</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="pi-empty">No products in this group.</p>}
            </section>

            <section className="pi-block pi-span-5">
              <header className="pi-block-head">
                <h2>Territory performance</h2>
                <Link className="pi-link" href="/admin/team">View team →</Link>
              </header>
              {data.territories?.length ? (
                <ul className="pi-territories">
                  {data.territories.map((row) => (
                    <li key={row.region}>
                      <button type="button" onClick={() => setTerritory(row)}>
                        <span className="pi-territory-head">
                          <strong>{row.region}</strong>
                          <em>{formatRupees(row.salesValue)}</em>
                        </span>
                        <span className="pi-territory-bar"><span style={{ width: `${Math.max((row.salesValue / territoryPeak) * 100, 2)}%` }} /></span>
                        <span className="pi-territory-meta">
                          <span className="pi-territory-lead">{row.topProducts[0] ? `Leading: ${row.topProducts[0].name}` : "No products"}</span>
                          {row.changePercent !== null && (
                            <b className={row.changePercent >= 0 ? "tone-positive" : "tone-negative"}>{row.changePercent >= 0 ? "+" : ""}{row.changePercent}%</b>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="pi-empty">No territory-linked sales in this period.</p>}
            </section>
          </div>

          <div className="pi-grid">
            <section className="pi-block pi-span-7">
              <header className="pi-block-head"><h2>Product movement</h2></header>
              <div className="pi-movement">
                <div>
                  <h3 className="is-up">Gaining</h3>
                  {data.gainers.length ? (
                    <ul className="pi-move-list">
                      {data.gainers.slice(0, 4).map((row) => (
                        <li key={row.name}><span title={row.name}>{row.name}</span><strong className="tone-positive">+{formatRupees(Math.abs(row.changeValue ?? 0))}</strong></li>
                      ))}
                    </ul>
                  ) : <p className="pi-empty small">None.</p>}
                </div>
                <div>
                  <h3 className="is-down">Declining</h3>
                  {data.losers.length ? (
                    <ul className="pi-move-list">
                      {data.losers.slice(0, 4).map((row) => (
                        <li key={row.name}><span title={row.name}>{row.name}</span><strong className="tone-negative">{row.growthPercent !== null ? `${row.growthPercent}%` : `−${formatRupees(Math.abs(row.changeValue ?? 0))}`}</strong></li>
                      ))}
                    </ul>
                  ) : <p className="pi-empty small">None.</p>}
                </div>
              </div>
            </section>

            <section className="pi-block pi-span-5">
              <header className="pi-block-head"><h2>Product lifecycle</h2></header>
              <div className="pi-lifecycle">
                <div>
                  <strong className="tone-positive">{formatNumber(data.newProducts.count)}</strong>
                  <span>New products</span>
                  <small>{formatRupees(data.newProducts.value)} billed</small>
                  <ul className="pi-move-list">
                    {data.newProducts.items.slice(0, 4).map((row) => <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(row.salesValue)}</strong></li>)}
                  </ul>
                </div>
                <div>
                  <strong className="tone-negative">{formatNumber(data.stoppedProducts.count)}</strong>
                  <span>Stopped selling</span>
                  <small>{formatRupees(data.stoppedProducts.value)} last year</small>
                  <ul className="pi-move-list">
                    {data.stoppedProducts.items.slice(0, 4).map((row) => <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(row.previousSalesValue)}</strong></li>)}
                  </ul>
                </div>
              </div>
              <p className="pi-foot-note">Top 5 products are {data.concentration.top5}% of sales · top 20 are {data.concentration.top20}% · {formatNumber(data.concentration.sellingProducts)} products sold.</p>
            </section>
          </div>
        </>}
      </AdminState>

      {product && <ProductDrawer product={product} onClose={() => setProduct(null)} />}
      {territory && <TerritoryDrawer territory={territory} onClose={() => setTerritory(null)} />}
    </main>
  );
}
