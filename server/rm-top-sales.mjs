import { authoritativeInvoiceWhere, netInvoiceLineAmount } from './tally/metrics.mjs';

const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

/** Read-only rankings. Never infer parent products from similar names or pack sizes. */
export function rmTopSales(database, { ids, dealers, from, to, totalSales, available, reason }) {
  if (!available) return { totalSales, customers: [], products: [], reason };
  const slots = ids.map(() => '?').join(',');
  const products = database.prepare(`
    SELECT CASE WHEN l.product_id IS NOT NULL THEN 'id:' || l.product_id ELSE 'name:' || l.product_name END id,
      COALESCE(p.name, MAX(l.product_name), 'Unnamed recorded product') name,
      SUM(${netInvoiceLineAmount('i', 'l')}) salesValue
    FROM tally_invoice_lines l
    JOIN tally_invoices i ON i.id=l.invoice_id
    JOIN tally_customers c ON c.id=i.customer_id
    LEFT JOIN tally_products p ON p.id=l.product_id
    WHERE ${authoritativeInvoiceWhere('i')}
      AND c.owner_user_id IN (${slots}) AND i.invoice_date BETWEEN ? AND ?
    GROUP BY CASE WHEN l.product_id IS NOT NULL THEN 'id:' || l.product_id ELSE 'name:' || l.product_name END
    ORDER BY salesValue DESC, id
  `).all(...ids, from, to);
  const rank = rows => [...rows].sort((a, b) => b.salesValue - a.salesValue || String(a.id).localeCompare(String(b.id))).slice(0, 5).map(row => ({
    id: row.id, name: row.name, salesValue: money(row.salesValue),
    sharePercent: totalSales > 0 ? money(row.salesValue / totalSales * 100) : null,
  }));
  const customerTotal = money(dealers.reduce((sum, row) => sum + row.salesValue, 0));
  const productTotal = money(products.reduce((sum, row) => sum + row.salesValue, 0));
  return {
    totalSales, customers: rank(dealers), products: rank(products), customerTotal, productTotal,
    productVariance: money(productTotal - totalSales),
    shareReason: totalSales > 0 ? null : 'Share is unavailable because total RM net sales are zero or negative.',
    reason: null,
  };
}
