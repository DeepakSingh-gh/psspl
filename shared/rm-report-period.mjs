import { businessDateRange, shiftBusinessDate } from './business-date.mjs';

/** Month-based seven-day reporting weeks, with a shorter final week. */
export function rmReportPeriod({ reportType, financialYear, month, week, weekScheme = 'calendar' }) {
  if (!['weekly', 'monthly', 'yearly'].includes(reportType)) throw new RangeError('Choose Weekly, Monthly or Yearly');
  if (!/^\d{4}-\d{2}$/.test(String(financialYear))) throw new RangeError('Choose a valid financial year');
  const startYear = Number(financialYear.slice(0, 4));
  if (startYear < 2000 || startYear > 2100 || financialYear !== `${startYear}-${String(startYear + 1).slice(-2)}`) throw new RangeError('Choose a valid financial year');
  let from = `${startYear}-04-01`, to = `${startYear + 1}-03-31`;
  if (reportType !== 'yearly') {
    const m = Number(month);
    if (!Number.isInteger(m) || m < 1 || m > 12) throw new RangeError('Choose a valid month');
    const year = startYear + (m < 4 ? 1 : 0);
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    let first = 1, end = last;
    if (reportType === 'weekly') {
      const w = Number(week);
      if (!['calendar','four'].includes(weekScheme)) throw new RangeError('Choose a valid reporting week scheme');
      if (!Number.isInteger(w) || w < 1 || w > (weekScheme === 'four' ? 4 : Math.ceil(last / 7))) throw new RangeError('Choose a valid week for this month');
      first = (w - 1) * 7 + 1;
      end = weekScheme === 'four' && w === 4 ? last : Math.min(first + 6, last);
    }
    const prefix = `${year}-${String(m).padStart(2, '0')}`;
    from = `${prefix}-${String(first).padStart(2, '0')}`;
    to = `${prefix}-${String(end).padStart(2, '0')}`;
  }
  return { ...businessDateRange(from, to), reportType, financialYear, weekScheme, label: reportType === 'weekly' ? 'Weekly' : reportType === 'monthly' ? 'Monthly' : 'Yearly' };
}

/** Prorate stored monthly targets by calendar days; missing months stay unknown. */
export function targetForRange(targets, from, to) {
  let value = 0;
  let cursor = from;
  while (cursor <= to) {
    const month = cursor.slice(0, 7);
    const days = new Date(Date.UTC(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7)), 0)).getUTCDate();
    const end = `${month}-${String(days).padStart(2, '0')}` < to ? `${month}-${String(days).padStart(2, '0')}` : to;
    const target = targets.get(month);
    if (target == null) return null;
    value += Number(target) * ((Date.parse(end) - Date.parse(cursor)) / 86400000 + 1) / days;
    cursor = shiftBusinessDate(end, 1);
  }
  return Math.round(value * 100) / 100;
}
