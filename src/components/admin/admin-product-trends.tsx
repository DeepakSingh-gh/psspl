"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatFinancialYear, formatNumber, formatPeriod, formatPercent, formatRupees } from "@/lib/format";
import type { ProductTrendRow, TerritoryRow, RecentSalesComparison } from "@/types/admin";
import { SalesTrend } from "./sales-performance-trend";
import trendStyles from "./sales-performance-trend.module.css";

type TrendView = "top" | "declining" | "slow";
type Grain = "month" | "quarter";

const MONTH_LONG = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const asDate = (period: string) => { const [y, m] = period.split("-").map(Number); return new Date(y, m - 1, 1); };
const longMonth = (period: string) => MONTH_LONG.format(asDate(period));

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

function Unavailable({reason}:{reason?:string|null}) {
  return <span style={{fontSize:12,fontWeight:500,lineHeight:1.5}}>Data Not Available{reason&&<small style={{display:'block',fontSize:11,fontWeight:400,lineHeight:1.4,marginTop:4}}>{reason}</small>}</span>;
}

function ProductDrawer({ product, recent, onClose }: { product: ProductTrendRow; recent?:RecentSalesComparison|null; onClose: () => void }) {
  const metric=recent?.metrics.find(row=>row.name===product.name),monthly=Boolean(metric?.paired);
  const currentRevenue=monthly?metric!.currentSales!:product.salesValue,previousRevenue=monthly?metric!.previousSales!:product.previousSalesValue;
  const growth=monthly?metric!.growthPercent:product.growthPercent;
  const peak = Math.max(currentRevenue,previousRevenue,1);
  return (
    <Drawer eyebrow={product.packingSize?`Product · ${product.parentName} · ${product.packingSize}`:'Product'} title={product.name} onClose={onClose}>
      <div className="pi-drawer-head">
        <strong>{formatRupees(product.salesValue)}</strong>
        {growth === null
          ? <span className="pi-chip is-new">{metric?.fyContributionPercent!=null?`${metric.fyContributionPercent.toFixed(2)}% of recorded FY sales`:`Data Not Available — ${product.previousAvailable===false?'no matching prior-period evidence':'growth requires a non-zero prior sales value'}`}</span>
          : <span className={`pi-chip ${growth >= 0 ? "is-up" : "is-down"}`}>{growth >= 0 ? "↑" : "↓"} {monthly?`${Math.abs(growth).toFixed(2)}% MoM`:formatPercent(Math.abs(growth))}</span>}
      </div>

      <section>
        <h3>Revenue</h3>
        {recent&&<p className="admin-note subtle">FY total above; {monthly?`${recent.label}: ${formatDate(recent.current.from)}–${formatDate(recent.current.to)} vs ${formatDate(recent.previous.from)}–${formatDate(recent.previous.to)}.`:`FY contribution uses the recorded FY item-line total. ${metric?.reason??'Monthly comparison is unavailable for this variant.'}`}</p>}
        <ul className="pi-compare">
          <li><span>{monthly?recent!.current.label:'Current period'}</span><span className="pi-compare-bar"><span style={{ width: `${Math.max(0,currentRevenue / peak * 100)}%` }} /></span><strong>{formatRupees(currentRevenue)}</strong></li>
          <li><span>{monthly?recent!.previous.label:'Previous period'}</span><span className="pi-compare-bar is-muted"><span style={{ width: `${Math.max(0,previousRevenue / peak * 100)}%` }} /></span><strong>{!monthly&&product.previousAvailable===false?<Unavailable reason="YoY requires matching prior-year invoice evidence."/>:formatRupees(previousRevenue)}</strong></li>
        </ul>
      </section>

      <dl className="admin-definition">
                <div><dt>{recent?'FY units':'Units'}</dt><dd>{formatNumber(product.quantity, 2)}</dd></div>
                <div><dt>{monthly?`Units in ${recent!.previous.label} (MoM)`:'Units last period'}</dt><dd>{monthly?formatNumber(metric!.previousQuantity,2):product.previousAvailable===false?<Unavailable reason="YoY requires matching prior-year quantity records."/>:formatNumber(product.previousQuantity, 2)}</dd></div>
                <div><dt>Customers</dt><dd>{product.customerCount==null?<Unavailable reason={product.unavailable?.customerCount}/>:formatNumber(product.customerCount)}</dd></div>
                <div><dt>Invoices</dt><dd>{product.invoiceCount==null?<Unavailable reason={product.unavailable?.invoiceCount}/>:formatNumber(product.invoiceCount)}</dd></div>
                <div><dt>{product.rateSource==='product_master'?'Recorded rate':'Average rate'}</dt><dd>{product.averageRate==null?<Unavailable reason={product.unavailable?.averageRate}/>:formatRupees(product.averageRate)}</dd></div>
                <div><dt>Months sold</dt><dd title={product.monthly?.map(row=>`${formatPeriod(row.period)}: ${formatNumber(row.quantity,2)} units${row.salesValue==null?' (monthly invoice sales unavailable)':` · ${formatRupees(row.salesValue)}`}`).join('; ')}>{product.monthsSold==null?<Unavailable reason={product.unavailable?.monthsSold}/>:formatNumber(product.monthsSold)}</dd></div>
                <div><dt>RM-wise sales</dt><dd>{product.byRm?.length?product.byRm.map(row=><span key={row.rmName} style={{display:'block'}}>{row.rmName} · {formatNumber(row.quantity,2)} units · {formatRupees(row.salesValue)}</span>):<Unavailable reason={product.unavailable?.byRm}/>}</dd></div>
      </dl>

      <section>
        <h3>Territories</h3>
        {product.regions?.length
          ? <ul className="pi-mini-list">{product.regions.map((row) => (
            <li key={row.region}><span>{row.region}</span><strong>{formatRupees(row.salesValue)}</strong></li>
          ))}</ul>
          : <p className="admin-note subtle">Data Not Available — no verified territory attribution for this product and period.</p>}
      </section>

      <Link className="admin-button" href="/admin/products">View full product list</Link>
    </Drawer>
  );
}

function TerritoryDrawer({ territory, previousAvailable, onClose }: { territory: TerritoryRow; previousAvailable?:boolean; onClose: () => void }) {
  return (
    <Drawer eyebrow="Territory" title={territory.region} onClose={onClose}>
      <div className="pi-drawer-head">
        <strong>{formatRupees(territory.salesValue)}</strong>
        {territory.changePercent === null
          ? <span className="pi-chip is-new">Data Not Available — no non-zero matching prior sales value</span>
          : <span className={`pi-chip ${territory.changePercent >= 0 ? "is-up" : "is-down"}`}>{territory.changePercent >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(territory.changePercent))}</span>}
      </div>

      <dl className="admin-definition">
        <div><dt>Previous period</dt><dd>{previousAvailable===false?<Unavailable reason="No matching prior-period source records."/>:formatRupees(territory.previousSalesValue)}</dd></div>
        <div><dt>Share of sales</dt><dd>{territory.sharePercent === null ? <Unavailable reason="A positive matching total is required to calculate sales share."/> : `${territory.sharePercent}%`}</dd></div>
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
          : <p className="admin-note subtle">Data Not Available — no product-attributed records exist for this territory and period.</p>}
      </section>

      <section>
        <h3>Top customers</h3>
        {territory.topCustomers.length
          ? <ul className="pi-mini-list">{territory.topCustomers.map((row) => (
            <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(row.salesValue)}</strong></li>
          ))}</ul>
          : <p className="admin-note subtle">Data Not Available — no customer-attributed records exist for this territory and period.</p>}
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

  const trends = useAdminData(() => adminApi.productTrends(financialYear || undefined), [financialYear], `admin-product-trends-${financialYear || "default"}`);
  const data = trends.data;
  const recent=data?.availability?.previousSales===false&&data.recentComparison?.available?data.recentComparison:null;
  const rows = (view==='declining'&&recent?recent.losers:data?.[view]??[]).slice(0, 6);
  const gainers=recent?.gainers??data?.gainers??[],losers=recent?.losers??data?.losers??[];
  const newProducts=recent?.lifecycle.newlyObserved??data?.newProducts,stoppedProducts=recent?.lifecycle.noRecentSales??data?.stoppedProducts;
  const comparisonsAvailable=Boolean(recent)||data?.availability?.previousSales!==false;
  const metricFor=(name:string)=>recent?.metrics.find(metric=>metric.name===name);

  const growthValue = recent?.difference??(data ? data.summary.totalSales - data.summary.previousTotalSales : 0);
  const growthPercent=recent?recent.growthPercent:data?.summary.growthPercent??null;
  const peakMonth = data?.monthlyTrend.filter(row=>row.salesValue!=null).reduce<(NonNullable<typeof data>['monthlyTrend'][number])|null>((best,row)=>best==null||(row.salesValue??-Infinity)>(best.salesValue??-Infinity)?row:best,null)??null;

  /** Short statements, each built from a figure the API returned. */
  const changes = useMemo(() => {
    type Change = { key: string; direction: "up" | "down" | "flat"; title: string; detail: string };
    if (!data) return [] as Change[];
    const items: Change[] = [];
    for (const row of comparisonsAvailable?gainers.slice(0,2):[]) {
      const change=recent?.metrics.find(metric=>metric.name===row.name)?.difference??row.changeValue??0;
      items.push({ key: `up-${row.name}`, direction: "up", title: row.name, detail: `+${formatRupees(Math.abs(change))} · ${recent?.label??'vs previous period'}` });
    }
    for (const row of comparisonsAvailable?losers.slice(0,2):[]) {
      const change=recent?.metrics.find(metric=>metric.name===row.name)?.difference??row.changeValue??0;
      items.push({ key: `down-${row.name}`, direction: "down", title: row.name, detail: `−${formatRupees(Math.abs(change))} · ${recent?.label??'vs previous period'}` });
    }
    if (newProducts?.count&&comparisonsAvailable) {
      items.push({ key: "new", direction: "flat", title: `${formatNumber(newProducts.count)} ${recent?'first recorded in '+recent.current.label:data.availability?.source==='historical_rm_product_snapshot'?'products without a prior record':'new products'}`, detail: `${formatRupees(newProducts.value)} recorded${recent?'; within '+formatDate(recent.lifecycle.from)+'–'+formatDate(recent.lifecycle.to):'; no matching prior sales record'}` });
    }
    if (stoppedProducts?.count&&comparisonsAvailable) {
      items.push({ key: "stopped", direction: "flat", title: `${formatNumber(stoppedProducts.count)} ${recent?'without positive net sales in '+recent.current.label:'products without a current record'}`, detail: `${formatRupees(stoppedProducts.value)} ${recent?'earlier in the recorded observation window':'recorded in the comparison year'}` });
    }
    return items.slice(0, 5);
  }, [data,recent,gainers,losers,newProducts,stoppedProducts,comparisonsAvailable]);

  const productPeak = Math.max(...rows.map((item) => item.salesValue), 1);
  const territoryPeak = Math.max(...(data?.territories ?? []).map((item) => item.salesValue), 1);

  return (
    <main className="pi">
      <header className="pi-header">
        <div>
          <p className="pi-eyebrow">Product intelligence</p>
          <h1>Product &amp; territory trends</h1>
          <p className="pi-sub">{recent?`Item-line sales recorded through ${formatDate(recent.observedThrough)}. Recent comparison: ${recent.label}; YoY remains unavailable.`:data?.availability?.source==='historical_rm_product_snapshot'?'Recorded annual product comparison snapshot; monthly invoice revenue is unavailable.':'Live sales performance compared with the same period last year.'}</p>
        </div>
        <div className="pi-controls">
          {data?.financialYears.length ? (
            <label className="pi-select">
              <span>Financial year</span>
              <select value={financialYear || data.financialYear} onChange={(event) => {setFinancialYear(event.target.value);setProduct(null);setTerritory(null);}}>
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
            <span className="pi-period"><i />{recent?'YoY baseline unavailable':'Previous'}<strong>{formatDate(data.previousStart)} → {formatDate(data.previousEnd)}</strong></span>
          </div>

          <section className="pi-summary">
            <div className="pi-figure is-lead">
              <strong>{data.availability?.currentSales===false?<Unavailable reason={data.availability.reason}/>:formatRupees(data.summary.totalSales)}</strong>
              <span>Current sales</span>
            </div>
            <div className="pi-figure">
              <strong className={growthPercent === null ? "" : growthPercent >= 0 ? "tone-positive" : "tone-negative"}>
                {growthPercent === null ? <Unavailable reason={recent?.growthReason??data.availability?.previousReason??'Growth requires an available non-zero prior-period sales value.'}/> : `${growthPercent >= 0 ? "+" : ""}${recent?growthPercent.toFixed(2):growthPercent}%`}
              </strong>
              <span>{recent?'MoM growth':'Growth'}{recent&&<small style={{display:'block'}}>{recent.label} · {formatRupees(recent.current.sales)} vs {formatRupees(recent.previous.sales)}</small>}</span>
            </div>
            <div className="pi-figure">
              <strong className={growthValue >= 0 ? "tone-positive" : "tone-negative"}>{!recent&&(data.availability?.currentSales===false||data.availability?.previousSales===false)?<Unavailable reason="Both matching periods need source evidence for an increment comparison."/>:<>{growthValue >= 0 ? "+" : "−"}{formatRupees(Math.abs(growthValue))}</>}</strong>
              <span>{recent?'MoM increment':'Increment'}{recent&&<small style={{display:'block'}}>{recent.label}</small>}</span>
            </div>
            <div className="pi-figure">
              <strong>{recent?formatRupees(recent.previous.sales):data.availability?.previousSales===false?<Unavailable reason={data.availability.previousReason}/>:formatRupees(data.summary.previousTotalSales)}</strong>
              <span>{recent?'Previous month (MoM)':'Previous period'}{recent&&<small style={{display:'block'}}>{recent.previous.label} · {formatDate(recent.previous.from)}–{formatDate(recent.previous.to)}</small>}</span>
            </div>
            <div className="pi-figure">
              <strong>{recent?formatNumber(recent.decliningCount):data.availability?.previousSales===false?<Unavailable reason={data.availability.previousReason}/>:formatNumber(data.summary.decliningProducts)}</strong>
              <span>Need attention{recent&&<small style={{display:'block'}}>{recent.label} · paired product observations only</small>}</span>
            </div>
          </section>

          <div className="pi-grid">
            <section className={`pi-panel pi-span-8 ${trendStyles.panel}`}>
              <header className={`pi-panel-head ${trendStyles.header}`}>
                <div className={trendStyles.heading}>
                  <h2>Sales Performance Trend</h2>
                  <p>Current vs previous FY</p>
                </div>
                <div className="pi-toggle" role="group" aria-label="Chart grain">
                  <button type="button" className={grain === "month" ? "is-on" : ""} onClick={() => setGrain("month")}>Monthly</button>
                  <button type="button" className={grain === "quarter" ? "is-on" : ""} onClick={() => setGrain("quarter")}>Quarterly</button>
                </div>
              </header>
              <SalesTrend key={financialYear || data.financialYear} rows={data.monthlyTrend} grain={grain} financialYear={financialYear || data.financialYear} periodEnd={data.periodEnd} pending={!!financialYear && financialYear !== data.financialYear} unavailableReason={data.availability?.monthlyReason} />
              <footer className="pi-panel-foot">
                {peakMonth && <span>Highest month <strong>{longMonth(peakMonth.period).split(" ")[0]} · {formatRupees(peakMonth.salesValue)}</strong></span>}
                <span>Current YTD <strong>{data.availability?.currentSales===false?<Unavailable reason={data.availability.reason}/>:formatRupees(data.summary.totalSales)}</strong></span>
                {recent&&<span>Latest recorded invoice <strong>{formatDate(recent.observedThrough)}</strong>. YoY needs dated prior-year invoices; annual snapshots cannot supply monthly YoY.</span>}
                {data.recentComparison?.reconciliation.headerLineDifference!=null&&Math.abs(data.recentComparison.reconciliation.headerLineDifference)>.01&&<span title={data.recentComparison.reconciliation.reason??undefined}>Item-line total reconciled; voucher-header variance <strong>{formatRupees(data.recentComparison.reconciliation.headerLineDifference)}</strong>. No allocation assumed.</span>}
              </footer>
            </section>

            <section className="pi-panel pi-span-4">
              <header className="pi-panel-head"><div><h2>What changed</h2><p>{recent?recent.label:'Against the same period last year'}</p></div></header>
              {changes.length ? (
                <ul className="pi-changes">
                  {changes.map((item) => (
                    <li key={item.key} className={`is-${item.direction}`}>
                      <i aria-hidden="true">{item.direction === "up" ? "↑" : item.direction === "down" ? "↓" : "•"}</i>
                      <div><strong title={item.title}>{item.title}</strong><small>{item.detail}</small></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="pi-empty">{!comparisonsAvailable?`Data Not Available — ${data.availability?.previousReason}`:'No classified movement in the stated comparison period.'}</p>}
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
                  <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "is-on" : ""} onClick={() => setView(id)}>{id==='declining'&&recent?'Declining (MoM)':label}</button>
                ))}
              </div>
              {rows.length ? (
                <ul className="pi-products">
                  {rows.map((row) => (
                    <li key={row.name}>
                      <div className="pi-product-row">
                        <span className="pi-product-name" title={row.name}>{row.name}</span>
                        <span className="pi-product-value">{formatRupees(row.salesValue)}</span>
                        <span className="pi-product-bar"><span style={{ width: `${Math.max((row.salesValue / productPeak) * 100, 2)}%` }} /></span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="pi-empty">{data.availability?.currentSales===false?`Data Not Available — ${data.availability.reason}`:'No products in this group.'}</p>}
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
              ) : <p className="pi-empty">Data Not Available — {data.availability?.territoryReason??'No territory-linked source records exist for this period.'}</p>}
            </section>
          </div>

          <div className="pi-grid">
            <section className="pi-block pi-span-7">
              <header className="pi-block-head"><h2>Product movement</h2>{recent&&<span>{recent.label}</span>}</header>
              <div className="pi-movement">
                <div>
                  <h3 className="is-up">Gaining</h3>
                  {!comparisonsAvailable?<p className="pi-empty small">Data Not Available — {data.availability?.previousReason}</p>:gainers.length ? (
                    <ul className="pi-move-list">
                      {gainers.slice(0, 4).map((row) => (
                        <li key={row.name}><span title={row.name}>{row.name}</span><strong className="tone-positive" title={recent?.label}>+{formatRupees(Math.abs(metricFor(row.name)?.difference??row.changeValue??0))}</strong></li>
                      ))}
                    </ul>
                  ) : <p className="pi-empty small">None.</p>}
                </div>
                <div>
                  <h3 className="is-down">Declining</h3>
                  {!comparisonsAvailable?<p className="pi-empty small">Data Not Available — {data.availability?.previousReason}</p>:losers.length ? (
                    <ul className="pi-move-list">
                      {losers.slice(0, 4).map((row) => (
                        <li key={row.name}><span title={row.name}>{row.name}</span><strong className="tone-negative" title={recent?.label}>{recent?`−${formatRupees(Math.abs(metricFor(row.name)?.difference??0))}`:row.growthPercent !== null ? `${row.growthPercent}%` : `−${formatRupees(Math.abs(row.changeValue ?? 0))}`}</strong></li>
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
                  <strong className="tone-positive">{!comparisonsAvailable?'Data Not Available':formatNumber(newProducts?.count)}</strong>
                  <span>{recent?`First recorded selling in ${recent.current.label}`:data.availability?.source==='historical_rm_product_snapshot'?'No prior-year record':'New products'}</span>
                  <small>{!comparisonsAvailable?data.availability?.previousReason:`${formatRupees(newProducts?.value)} ${recent?'recorded in '+recent.current.label:'billed'}`}</small>
                  <ul className="pi-move-list">
                    {(!comparisonsAvailable?[]:newProducts?.items.slice(0,4)??[]).map((row) => <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(recent?row.observedWindowSales:row.salesValue)}</strong></li>)}
                  </ul>
                </div>
                <div>
                  <strong className="tone-negative">{!comparisonsAvailable?'Data Not Available':formatNumber(stoppedProducts?.count)}</strong>
                  <span>{recent?`No positive net sales in ${recent.current.label}`:data.availability?.source==='historical_rm_product_snapshot'?'No current-year record':'Stopped selling'}</span>
                  <small>{!comparisonsAvailable?data.availability?.previousReason:`${formatRupees(stoppedProducts?.value)} ${recent?'earlier in the observation window':'last year'}`}</small>
                  <ul className="pi-move-list">
                    {(!comparisonsAvailable?[]:stoppedProducts?.items.slice(0,4)??[]).map((row) => <li key={row.name}><span title={row.name}>{row.name}</span><strong>{formatRupees(recent?row.observedWindowSales:row.previousSalesValue)}</strong></li>)}
                  </ul>
                </div>
              </div>
              <p className="pi-foot-note">{data.concentration.top5==null||data.concentration.top20==null?'Data Not Available — sales concentration requires a positive observed sales total.':<>Top 5 products are {data.concentration.top5}% of sales · top 20 are {data.concentration.top20}% · {formatNumber(data.concentration.sellingProducts)} products sold.</>}</p>
              {recent&&<p className="pi-foot-note">Observation window: {formatDate(recent.lifecycle.from)}–{formatDate(recent.lifecycle.to)}. {recent.lifecycle.consistent.count==null?recent.lifecycle.consistent.reason:`${formatNumber(recent.lifecycle.consistent.count)} products recorded positive net sales in all ${recent.lifecycle.consistent.months} observed months.`} {recent.lifecycle.note}</p>}
            </section>
          </div>
        </>}
      </AdminState>

      {product && <ProductDrawer product={product} recent={recent} onClose={() => setProduct(null)} />}
      {territory && <TerritoryDrawer territory={territory} previousAvailable={data?.availability?.previousSales} onClose={() => setTerritory(null)} />}
    </main>
  );
}
