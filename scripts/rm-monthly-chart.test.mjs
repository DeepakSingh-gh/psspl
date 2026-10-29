import test from 'node:test';
import assert from 'node:assert/strict';
import { rmMonthlyChart } from '../shared/rm-monthly-chart.mjs';

test('four weekly buckets use complete dated invoices including returns and month-end days', () => {
  const result = rmMonthlyChart({ monthlyPerformance: { from: '2026-10-01', to: '2026-10-31', actual: 400, target: 3100 }, salesInvoiceCount: 5, actualSales: [
    { invoiceDate: '2026-10-01', amount: 100 }, { invoiceDate: '2026-10-08', amount: 200 },
    { invoiceDate: '2026-10-15', amount: -50 }, { invoiceDate: '2026-10-22', amount: 50 }, { invoiceDate: '2026-10-31', amount: 100 },
  ] });
  assert.equal(result.demo, false);
  assert.deepEqual(result.rows.map(row => row.actual), [100, 200, -50, 150]);
  assert.deepEqual(result.rows.map(row => row.target), [700, 700, 700, 1000]);
  assert.equal(result.rows[3].to, '2026-10-31');
});

test('PDF monthly aggregates use a labeled sample split without changing their totals or source month', () => {
  const data = { monthlyPerformance: { from: '2026-09-01', to: '2026-09-30', actual: 656000, target: 1128000 }, from: '2026-10-01', to: '2026-10-22', actualSales: [] };
  const before = structuredClone(data);
  const { rows, demo, month } = rmMonthlyChart(data);
  assert.equal(demo, true);
  assert.equal(month, '2026-09');
  assert.equal(rows.length, 4);
  assert.equal(rows.reduce((sum, row) => sum + row.actual, 0), 656000);
  assert.equal(rows.reduce((sum, row) => sum + row.target, 0), 1128000);
  assert.deepEqual(data, before);
});

test('future weeks and missing figures stay unavailable; partial invoice lists are not treated as complete', () => {
  const { rows, demo } = rmMonthlyChart({ monthlyPerformance: { from: '2026-10-01', to: '2026-10-14', actual: 300, target: 1000 }, salesInvoiceCount: 2, actualSales: [{ invoiceDate: '2026-10-01', amount: 300 }] });
  assert.equal(demo, true);
  assert.equal(rows[2].actual, null);
  assert.equal(rows[3].actual, null);
  assert.equal(rows[0].actual + rows[1].actual, 300);
  const missing = rmMonthlyChart({ from: '2026-02-01', to: '2026-02-28', monthlyPerformance: { actual: null, target: null } });
  assert.ok(missing.rows.every(row => row.actual === null && row.target === null));
});
