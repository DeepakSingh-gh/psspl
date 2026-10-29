"use client";
import { FullSalesReportPrint, reportCsv, reportExcelCell, reportExcelTable } from "../../../shared/report-export.mjs";
import { reportDateRange, type ReportPreset } from "@/lib/business-date";
import { Fragment, useMemo, useState } from "react";
import { AdminPage, AdminState, StatTile } from "./admin-shell";
import { Pager, usePagination } from "./use-pagination";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { formatDate, formatNumber, formatPeriod, formatPercent, formatRupees } from "@/lib/format";

type MonthRow = {
  period: string; salesValue: number; grossSalesValue: number; returnValue: number; returnCount: number;
  invoiceCount: number; customerCount: number; averageInvoice: number; quantity: number; productCount: number;
  receiptCount: number; receiptValue: number; sharePercent: number | null; changePercent: number | null;
  topProducts: Array<{ name: string; salesValue: number; quantity: number }>;
  topCustomers: Array<{ name: string; salesValue: number; invoiceCount: number }>;
};


type PersonRow = {
  name: string; region: string; salesValue: number; invoiceCount: number; customerCount: number;
  averageInvoice: number; sharePercent: number | null; assignedCustomers: number;
  receiptCount: number; receiptValue: number;
  monthly: Array<{ period: string; salesValue: number; invoiceCount: number }>;
  topProducts: Array<{ name: string; salesValue: number; quantity: number }>;
  topCustomers: Array<{ name: string; salesValue: number; invoiceCount: number }>;
};

/** Salesperson / RM view: one expandable row per person with their own drivers. */
function SalespersonReport({ rows }: { rows: PersonRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <p className="admin-placeholder">No sales in this date range.</p>;
  const peak = Math.max(...rows.map((row) => row.salesValue), 1);

  return (
    <div className="admin-table-wrap month-report">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Salesperson / RM</th><th>Region</th><th className="numeric">Sales</th>
            <th className="numeric">Share</th><th className="numeric">Invoices</th>
            <th className="numeric">Customers</th><th className="numeric">Receipts</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = open === row.name;
            const monthPeak = Math.max(...row.monthly.map((m) => m.salesValue), 1);
            return (
              <Fragment key={row.name}>
                <tr className={`month-row${expanded ? " is-open" : ""}`} onClick={() => setOpen(expanded ? null : row.name)}>
                  <td>
                    <strong className="admin-cell-title">{row.name}</strong>
                    <span className="month-spark"><span style={{ width: `${Math.max((row.salesValue / peak) * 100, 2)}%` }} /></span>
                  </td>
                  <td>{row.region}</td>
                  <td className="numeric"><strong>{formatRupees(row.salesValue)}</strong><small>avg {formatRupees(row.averageInvoice)}</small></td>
                  <td className="numeric">{row.sharePercent === null ? "—" : `${row.sharePercent}%`}</td>
                  <td className="numeric">{formatNumber(row.invoiceCount)}</td>
                  <td className="numeric">{formatNumber(row.customerCount)}<small>of {formatNumber(row.assignedCustomers)} assigned</small></td>
                  <td className="numeric">{formatRupees(row.receiptValue)}<small>{formatNumber(row.receiptCount)} vouchers</small></td>
                  <td className="numeric"><button type="button" className="month-toggle" aria-expanded={expanded}>{expanded ? "Hide" : "Detail"}</button></td>
                </tr>
                {expanded && (
                  <tr className="month-detail">
                    <td colSpan={8}>
                      <div className="month-detail-grid">
                        <dl className="month-figures">
                          <div><dt>Sales in period</dt><dd>{formatRupees(row.salesValue)}</dd></div>
                          <div><dt>Average invoice</dt><dd>{formatRupees(row.averageInvoice)}</dd></div>
                          <div><dt>Customers billed</dt><dd>{formatNumber(row.customerCount)}</dd></div>
                          <div><dt>Customers assigned</dt><dd>{formatNumber(row.assignedCustomers)}<small>{Math.max(row.assignedCustomers - row.customerCount, 0)} did not order</small></dd></div>
                          <div><dt>Receipts banked</dt><dd>{formatRupees(row.receiptValue)}<small>{formatNumber(row.receiptCount)} receipt vouchers</small></dd></div>
                          <div><dt>Share of period sales</dt><dd>{row.sharePercent === null ? "—" : `${row.sharePercent}%`}</dd></div>
                        </dl>

                        <div className="month-lists">
                          <section>
                            <h4>Month by month</h4>
                            {row.monthly.length ? (
                              <ul className="person-months">{row.monthly.map((m) => (
                                <li key={m.period}>
                                  <span>{formatPeriod(m.period)}</span>
                                  <span className="person-bar"><span style={{ width: `${Math.max((m.salesValue / monthPeak) * 100, 2)}%` }} /></span>
                                  <strong>{formatRupees(m.salesValue)}</strong>
                                  <small>{formatNumber(m.invoiceCount)} inv</small>
                                </li>
                              ))}</ul>
                            ) : <p className="admin-note subtle">No monthly breakdown.</p>}
                          </section>
                          <section>
                            <h4>Top products</h4>
                            {row.topProducts.length ? (
                              <ol>{row.topProducts.map((item) => (
                                <li key={item.name}><span title={item.name}>{item.name}</span><strong>{formatRupees(item.salesValue)}</strong><small>{formatNumber(item.quantity, 2)} qty</small></li>
                              ))}</ol>
                            ) : <p className="admin-note subtle">No product lines.</p>}
                          </section>
                          <section>
                            <h4>Top customers</h4>
                            {row.topCustomers.length ? (
                              <ol>{row.topCustomers.map((item) => (
                                <li key={item.name}><span title={item.name}>{item.name}</span><strong>{formatRupees(item.salesValue)}</strong><small>{formatNumber(item.invoiceCount)} invoices</small></li>
                              ))}</ol>
                            ) : <p className="admin-note subtle">No customers.</p>}
                          </section>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Month-wise view: one expandable row per month with its own drivers. */
function MonthlyReport({ rows }: { rows: MonthRow[] }) {
  const [open, setOpen] = useState<string | null>(rows.length === 1 ? rows[0].period : null);
  if (!rows.length) return <p className="admin-placeholder">No invoices in this date range.</p>;
  const peak = Math.max(...rows.map((row) => row.salesValue), 1);

  return (
    <div className="admin-table-wrap month-report">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Month</th><th className="numeric">Net sales</th><th className="numeric">Share</th>
            <th className="numeric">Vs previous</th><th className="numeric">Invoices</th>
            <th className="numeric">Customers</th><th className="numeric">Receipts</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = open === row.period;
            return (
              <Fragment key={row.period}>
                <tr className={`month-row${expanded ? " is-open" : ""}`} onClick={() => setOpen(expanded ? null : row.period)}>
                  <td>
                    <strong className="admin-cell-title">{formatPeriod(row.period)}</strong>
                    <span className="month-spark"><span style={{ width: `${Math.max((row.salesValue / peak) * 100, 2)}%` }} /></span>
                  </td>
                  <td className="numeric"><strong>{formatRupees(row.salesValue)}</strong><small>avg {formatRupees(row.averageInvoice)}</small></td>
                  <td className="numeric">{row.sharePercent === null ? "—" : `${row.sharePercent}%`}</td>
                  <td className="numeric">{row.changePercent === null ? <span className="admin-muted">—</span> : <span className={row.changePercent >= 0 ? "tone-positive" : "tone-negative"}>{row.changePercent >= 0 ? "+" : ""}{row.changePercent}%</span>}</td>
                  <td className="numeric">{formatNumber(row.invoiceCount)}</td>
                  <td className="numeric">{formatNumber(row.customerCount)}</td>
                  <td className="numeric">{formatRupees(row.receiptValue)}<small>{formatNumber(row.receiptCount)} vouchers</small></td>
                  <td className="numeric"><button type="button" className="month-toggle" aria-expanded={expanded}>{expanded ? "Hide" : "Detail"}</button></td>
                </tr>
                {expanded && (
                  <tr className="month-detail">
                    <td colSpan={8}>
                      <div className="month-detail-grid">
                        <dl className="month-figures">
                          <div><dt>Gross sales</dt><dd>{formatRupees(row.grossSalesValue)}</dd></div>
                          <div><dt>Returns / credit notes</dt><dd className={row.returnCount ? "tone-negative" : undefined}>{formatRupees(row.returnValue)}<small>{formatNumber(row.returnCount)} vouchers</small></dd></div>
                          <div><dt>Net sales</dt><dd>{formatRupees(row.salesValue)}</dd></div>
                          <div><dt>Average invoice</dt><dd>{formatRupees(row.averageInvoice)}</dd></div>
                          <div><dt>Quantity billed</dt><dd>{formatNumber(row.quantity, 2)}</dd></div>
                          <div><dt>Distinct products</dt><dd>{formatNumber(row.productCount)}</dd></div>
                          <div><dt>Receipts banked</dt><dd>{formatRupees(row.receiptValue)}<small>{formatNumber(row.receiptCount)} receipt vouchers</small></dd></div>
                        </dl>

                        <div className="month-lists">
                          <section>
                            <h4>Top products</h4>
                            {row.topProducts.length ? (
                              <ol>{row.topProducts.map((item) => (
                                <li key={item.name}><span title={item.name}>{item.name}</span><strong>{formatRupees(item.salesValue)}</strong><small>{formatNumber(item.quantity, 2)} qty</small></li>
                              ))}</ol>
                            ) : <p className="admin-note subtle">No product lines for this month.</p>}
                          </section>
                          <section>
                            <h4>Top customers</h4>
                            {row.topCustomers.length ? (
                              <ol>{row.topCustomers.map((item) => (
                                <li key={item.name}><span title={item.name}>{item.name}</span><strong>{formatRupees(item.salesValue)}</strong><small>{formatNumber(item.invoiceCount)} invoices</small></li>
                              ))}</ol>
                            ) : <p className="admin-note subtle">No customers for this month.</p>}
                          </section>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
type View = "monthly" | "product" | "salesperson" | "region" | "customer";
function initialDates() { return reportDateRange("month"); }
export function AdminReports() {
  const defaults = useMemo(initialDates, []); const [from, setFrom] = useState(defaults.from); const [to, setTo] = useState(defaults.to); const [range, setRange] = useState(defaults); const [view, setView] = useState<View>("monthly"); const [savedMessage, setSavedMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const changed = from !== range.from || to !== range.to;
  const report = useAdminData(() => adminApi.salesReport(range.from, range.to), [range.from, range.to]); const data = report.data;
  const busy = report.refreshing || Boolean(!report.error && data && (data.from !== range.from || data.to !== range.to));
  const rows = data ? view === "monthly" ? data.monthly : view === "product" ? data.byProduct : view === "salesperson" ? data.bySalesperson : view === "region" ? data.byRegion : data.byCustomer : [];
  const headings = view === "monthly" ? ["Month", "Gross sales", "Returns", "Net sales", "Invoices", "Average invoice", "Customers", "Quantity", "Products", "Receipts", "Receipt vouchers", "Share %", "Change %"] : view === "product" ? ["Product", "Sales", "Quantity", "Invoices"] : view === "salesperson" ? ["Salesperson / RM", "Region", "Sales", "Average invoice", "Invoices", "Customers billed", "Customers assigned", "Receipts", "Receipt vouchers", "Share %"] : view === "region" ? ["Region", "Sales", "Invoices", "Customers"] : ["Customer", "Sales", "Invoices", "Outstanding"];
  const values = rows.map((row: any) => view === "monthly" ? [row.period, row.grossSalesValue, row.returnValue, row.salesValue, row.invoiceCount, Math.round(row.averageInvoice), row.customerCount, row.quantity, row.productCount, row.receiptValue, row.receiptCount, row.sharePercent, row.changePercent] : view === "product" ? [row.name, row.salesValue, row.quantity, row.invoiceCount] : view === "salesperson" ? [row.name, row.region, row.salesValue, Math.round(row.averageInvoice ?? 0), row.invoiceCount, row.customerCount, row.assignedCustomers, row.receiptValue, row.receiptCount, row.sharePercent] : view === "region" ? [row.name, row.salesValue, row.invoiceCount, row.customerCount] : [row.name, row.salesValue, row.invoiceCount, row.outstanding]);
  // Paging affects the table only — exports below still use every row.
  const paged = usePagination(rows as any[], 25, view);
  function download(blob: Blob, filename: string) { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
  const activeFilters = Object.entries(data?.filters ?? {}).filter(([, value]) => value.trim()).map(([key, value]) => `${key}=${value.trim()}`);
  function downloadCsv() { if (!data || !rows.length) return; const csv = reportCsv([["Data source", "Authoritative Tally"], ["Reporting period", `${data.from} to ${data.to}`], ["Filters", activeFilters.join("; ") || "None"], ["Total sales (INR)", data.summary.totalSales], [], headings, ...values]); download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `PSSPL-${view}-sales-${data.from}-to-${data.to}.csv`); }
  function downloadExcel() { if (!data || !rows.length) return; const table = reportExcelTable(headings, values); download(new Blob([`<html><head><meta charset="utf-8"></head><body><h2>Progressive Surface Systems - ${reportExcelCell(view)} sales</h2><p>Authoritative Tally · ${reportExcelCell(data.from)} to ${reportExcelCell(data.to)}</p><p>Filters: ${reportExcelCell(activeFilters.join("; ") || "None")}</p><p>Total sales (INR): ${reportExcelCell(data.summary.totalSales)}</p>${table}</body></html>`], { type: "application/vnd.ms-excel" }), `PSSPL-${view}-sales-${data.from}-to-${data.to}.xls`); }
  function generate(next = { from, to }) {
    if (!next.from || !next.to || next.from > next.to) { setFormError("Choose a valid From and To date range."); return; }
    setFormError(""); setSavedMessage("");
    if (next.from === range.from && next.to === range.to) report.reload();
    else { setRange(next); }
  }
  function applyPreset(preset: ReportPreset) { const next = reportDateRange(preset); setFrom(next.from); setTo(next.to); generate(next); }
  async function saveReport() {
    if (!data || busy || report.error || changed || saving) return;
    setSaving(true); setFormError("");
    try { await adminApi.saveReport(data.from, data.to, view, data.filters); setSavedMessage("Filtered report saved to history."); }
    catch (error) { setFormError(error instanceof Error ? error.message : "Unable to save report. Try again."); }
    finally { setSaving(false); }
  }
  return <AdminPage eyebrow="Reports" title="Sales reports" description="Generate, export and retain live Tally sales reports for management.">
    <div className="report-controls"><label className="admin-field"><span className="admin-field-label">From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="admin-field"><span className="admin-field-label">To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="admin-button" onClick={() => generate()}>Generate report</button><button className="admin-button ghost" onClick={downloadCsv} disabled={changed || !rows.length || busy || Boolean(report.error)}>CSV</button><button className="admin-button ghost" onClick={downloadExcel} disabled={changed || !rows.length || busy || Boolean(report.error)}>Excel</button><button className="admin-button ghost" onClick={() => window.print()} disabled={changed || !data || busy || Boolean(report.error)}>Print / Save PDF</button></div>
    <div className="report-presets"><span>Quick range:</span><button onClick={() => applyPreset("today")}>Today</button><button onClick={() => applyPreset("week")}>Last 7 days</button><button onClick={() => applyPreset("month")}>This month</button><button onClick={() => applyPreset("lastMonth")}>Last month</button><button onClick={() => applyPreset("fy")}>Financial year to date</button></div>
    {formError && <p className="admin-error" role="alert">{formError}</p>}
    {changed && <p className="admin-note" role="status">Dates changed. Click Generate report to apply them.</p>}
    {!busy && !report.error && data?.summary.invoiceCount === 0 && <p className="admin-note">No invoices match this period. Try Last month or Financial year to date.</p>}
    <AdminState loading={busy} error={report.error} onRetry={report.reload} empty={false}>{data && <><div className="admin-stats"><StatTile label="Total sales" value={formatRupees(data.summary.totalSales)} sub={`${formatDate(data.from)} to ${formatDate(data.to)}`} /><StatTile label="Invoices" value={formatNumber(data.summary.invoiceCount)} sub={`Average ${formatRupees(data.summary.averageInvoice)}`} /><StatTile label="Customers" value={formatNumber(data.summary.customerCount)} sub={`${data.summary.repeatCustomers} repeat customers`} /><StatTile label="Repeat rate" value={formatPercent(data.summary.repeatCustomerPercent)} sub="Customers invoiced more than once" /></div>
      <div className="report-view-bar"><label className="admin-select"><span>Group report by</span><select value={view} onChange={(event) => setView(event.target.value as View)}><option value="monthly">Month</option><option value="product">Product</option><option value="salesperson">Salesperson / RM</option><option value="region">Region</option><option value="customer">Customer</option></select></label><div className="report-save"><small>{formatNumber(rows.length)} rows · live Tally data</small><button className="admin-button small" onClick={saveReport} disabled={changed || busy || Boolean(report.error) || saving}>{saving ? "Saving…" : "Save report"}</button></div></div>{savedMessage && <p className="admin-note">{savedMessage}</p>}{view === "product" && data.summary.unallocatedProductInvoices > 0 && <p className="admin-note">{formatRupees(data.summary.unallocatedProductSales)} from {data.summary.unallocatedProductInvoices} sales vouchers is not assigned to products because Tally inventory lines were not received. These vouchers are listed under Tally data health.</p>}
      <div className="sales-report-screen">{view === "monthly" ? <MonthlyReport rows={paged.rows as MonthRow[]} />
        : view === "salesperson" ? <SalespersonReport rows={paged.rows as PersonRow[]} />
        : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{view[0].toUpperCase() + view.slice(1)}</th><th className="numeric">Sales</th>{view === "product" && <th className="numeric">Quantity</th>}<th className="numeric">Invoices</th>{view !== "product" && view !== "customer" && <th className="numeric">Customers</th>}{view === "customer" && <th className="numeric">Outstanding</th>}</tr></thead><tbody>{paged.rows.map((row: any) => <tr key={row.period ?? `${row.name}-${row.region ?? ""}`}><td><strong className="admin-cell-title">{row.period ? formatPeriod(row.period) : row.name}</strong></td><td className="numeric">{formatRupees(row.salesValue)}</td>{view === "product" && <td className="numeric">{formatNumber(row.quantity, 2)}</td>}<td className="numeric">{formatNumber(row.invoiceCount)}</td>{view !== "product" && view !== "customer" && <td className="numeric">{formatNumber(row.customerCount)}</td>}{view === "customer" && <td className="numeric">{formatRupees(row.outstanding)}</td>}</tr>)}</tbody></table></div>}<Pager pagination={paged} label={view === "monthly" ? "months" : "rows"} /></div><FullSalesReportPrint headings={headings} rows={values} from={data.from} to={data.to} filters={activeFilters} totalSales={data.summary.totalSales} />
    </>}</AdminState>
  </AdminPage>;
}
