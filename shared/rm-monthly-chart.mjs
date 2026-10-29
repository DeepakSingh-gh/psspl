/** Four reporting buckets: 1-7, 8-14, 15-21 and 22-month end. */
export function rmMonthlyChart(data) {
  const source = data.insightSource ?? data;
  const performance = source.monthlyPerformance ?? {};
  const month = (performance.from ?? source.reportSource?.asOf ?? source.effectiveTo ?? source.to).slice(0, 7);
  const [year, number] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const asOf = performance.to ?? source.reportSource?.asOf ?? source.effectiveTo ?? source.to;
  const through = asOf?.slice(0, 7) === month ? Number(asOf.slice(8, 10)) : days;
  const actual = performance.actual ?? source.kpi?.actualSalesValue ?? null;
  const target = performance.target ?? source.kpi?.targetValue ?? null;
  const invoices = (source.actualSales ?? []).filter(row => row.invoiceDate?.slice(0, 7) === month && row.invoiceDate <= asOf);
  const invoiceTotal = invoices.reduce((sum, row) => sum + row.amount, 0);
  const complete = actual != null && Number.isFinite(invoiceTotal) && Math.abs(invoiceTotal - actual) < 0.01 && (source.salesInvoiceCount ?? invoices.length) <= invoices.length;
  const demo = !complete && actual != null && actual !== 0;
  const ends = [7, 14, 21, days];
  const weights = [0.22, 0.28, 0.24, 0.26].map((weight, index) => weight * Math.max(0, Math.min(ends[index], through) - index * 7) / (ends[index] - index * 7));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const lastActive = weights.findLastIndex(weight => weight > 0);
  let allocatedActual = 0;
  let allocatedTarget = 0;
  const rows = ends.map((end, index) => {
    const start = index * 7 + 1;
    const from = `${month}-${String(start).padStart(2, '0')}`;
    const to = `${month}-${String(end).padStart(2, '0')}`;
    const weeklyTarget = target == null ? null : index === 3 ? target - allocatedTarget : Math.round(target * (end - start + 1) / days * 100) / 100;
    if (weeklyTarget != null) allocatedTarget += weeklyTarget;
    let weeklyActual = null;
    if (actual != null && start <= through) {
      weeklyActual = complete ? invoices.filter(row => row.invoiceDate >= from && row.invoiceDate <= to).reduce((sum, row) => sum + row.amount, 0)
        : actual === 0 ? 0 : index === lastActive ? actual - allocatedActual : Math.round(actual * weights[index] / weightTotal * 100) / 100;
      allocatedActual += weeklyActual;
    }
    return { month: from, label: `Week ${index + 1}`, from, to, target: weeklyTarget, actual: weeklyActual, achievementPercent: weeklyActual == null || weeklyTarget == null || weeklyTarget <= 0 ? null : Math.round(weeklyActual / weeklyTarget * 100) };
  });
  return { rows, demo, month };
}
