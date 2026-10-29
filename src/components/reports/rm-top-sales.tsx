import type { RmPerformanceReport } from '../../../shared/rm-performance.mjs';
import { formatRupees } from '@/lib/format';

/** Dashboard and PDF share verified rows or explicitly labeled local preview samples. */
export function RmTopSales({ report }: { report: RmPerformanceReport }) {
  const data = report.topSales;
  return <section className="rm-top-sales" aria-label="Top customers and products" data-report-section="top-sales">
    {(['customers', 'products'] as const).map(kind => {
      const customer = kind === 'customers', rows = data?.[kind] ?? [];
      const demoLabel = customer ? data?.customerDemo?.label : data?.productDemo?.label;
      const title = customer ? 'Top Customers (5)' : 'Top Products (5)';
      return <article className="rm-top-sales-card" key={kind} data-top-sales={kind}>
        <h3><span aria-hidden="true">{customer ? '🤝' : '📦'}</span>{title}</h3>
        {rows.length ? <table aria-label={title}>
          <colgroup><col className="rm-top-rank"/><col/><col className="rm-top-amount"/><col className="rm-top-share"/></colgroup>
          <thead><tr><th scope="col">#</th><th scope="col">{customer ? 'Customer' : 'Product'}</th><th scope="col" className="numeric">Sales</th><th scope="col" className="numeric">Share</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.id}>
            <td>{index + 1}</td><th scope="row"><span className="rm-top-name" title={row.name}>{row.name}</span></th>
            <td className="numeric rm-top-sales-value">{formatRupees(row.salesValue)}</td>
            <td className="numeric">{row.sharePercent == null ? <span title={'sample' in row && row.sample ? 'Sample row: excluded from recorded totals and shares.' : data?.shareReason ?? 'A positive RM sales total is required.'}>N/A</span> : `${row.sharePercent.toFixed(2)}%`}</td>
          </tr>)}</tbody>
        </table> : <p className="rm-top-empty">Data Not Available — {data?.reason ?? `No recorded ${customer ? 'customer invoices' : 'product invoice lines'} exist for the selected RM and period.`}</p>}
        {!!rows.length && <p className="rm-top-source">{demoLabel ?? data?.shareReason ?? 'Share of total RM net sales for the selected period.'}{!customer && !data?.productDemo && data?.productVariance != null && Math.abs(data.productVariance) > 0.01 && <> Item-line total differs from voucher sales by {data.productVariance < 0 ? '−' : '+'}{formatRupees(Math.abs(data.productVariance))}; no adjustment assumed.</>}</p>}
      </article>;
    })}
  </section>;
}
