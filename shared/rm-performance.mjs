import { rmReportPeriod } from './rm-report-period.mjs';
import { shiftBusinessDate } from './business-date.mjs';

export const WEEK_RULE = 'Reporting weeks: days 1–7, 8–14, 15–21, and 22–month end. Adopted date boundaries; source PDFs do not specify calendar boundaries.';
export const round = value => Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null;
export function variations(actual, target, previousActual = null) {
  const known = value => typeof value === 'number' && Number.isFinite(value);
  const variation = known(actual) && known(target) ? round(actual - target) : null;
  return {
    actual, target, previousActual,
    achievementPercent: known(actual) && known(target) && target !== 0 ? round(actual / target * 100) : null,
    variation, variationPercent: variation != null && target !== 0 ? round(variation / target * 100) : null,
    growthPercent: known(actual) && known(previousActual) && previousActual !== 0 ? round((actual - previousActual) / previousActual * 100) : null,
  };
}
export function financialMonths(financialYear) {
  rmReportPeriod({ financialYear, reportType: 'yearly' });
  return Array.from({ length: 12 }, (_, index) => {
    const month = (index + 3) % 12 + 1;
    const range = rmReportPeriod({ financialYear, reportType: 'monthly', month });
    return { month, ...range, key: range.from.slice(0, 7), label: new Date(`${range.from}T12:00:00Z`).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }) };
  });
}
export function reportingWeeks(financialYear, month) {
  return Array.from({ length: 4 }, (_, index) => ({ ...rmReportPeriod({ financialYear, reportType: 'weekly', month, week: index + 1, weekScheme: 'four' }), week: index + 1, key: `week-${index + 1}`, label: `Week ${index + 1}` }));
}
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
const previousYearDate = date => {
  const year = Number(date.slice(0, 4)) - 1;
  const month = Number(date.slice(5, 7));
  const day = Math.min(Number(date.slice(8)), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
/** Compare equal elapsed calendar days, bounded by the previous month/week. */
export function comparisonRange(selection, cutoff) {
  const range = rmReportPeriod(selection);
  if (cutoff < range.from) return null;
  const effectiveTo = cutoff < range.to ? cutoff : range.to;
  if (selection.reportType === 'yearly') return { from: previousYearDate(range.from), to: previousYearDate(effectiveTo), label: 'Previous FY, same elapsed dates' };
  let prior;
  if (selection.reportType === 'monthly') {
    const end = shiftBusinessDate(range.from, -1);
    prior = { from: `${end.slice(0, 7)}-01`, to: end };
  } else {
    const week = Number(selection.week);
    const end = shiftBusinessDate(range.from, -1);
    prior = week > 1 ? { from: shiftBusinessDate(range.from, -7), to: end } : { from: `${end.slice(0, 7)}-22`, to: end };
  }
  const comparableEnd = shiftBusinessDate(prior.from, daysBetween(range.from, effectiveTo) - 1);
  return { from: prior.from, to: comparableEnd < prior.to ? comparableEnd : prior.to, label: selection.reportType === 'monthly' ? 'Previous month, comparable elapsed days' : 'Previous reporting week, comparable elapsed days' };
}

/** Transparent deterministic narratives shared by screen and PDF. No model claims. */
export function performanceNarratives(report) {
  const { summary: s, kpi: k, historical } = report;
  const money = value => value == null ? 'N/A' : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const items = [];
  const add = (id, title, points, action, high = false) => items.push({ id, title, points, action, priority: high ? 'High' : 'Review', reason: points[0] });
  if (s.actual != null) add('achievement', 'Sales Target Achievement', [
    s.achievementPercent == null ? `Actual sales ${money(s.actual)}; a verified target comparison is unavailable.` : `Sales ${historical ? 'achieved' : 'have achieved'} ${s.achievementPercent}% of target; actual ${money(s.actual)}, target ${money(s.target)}.`,
    s.variation == null ? 'A reliable target is required to assess the gap.' : s.variation === 0 ? 'Sales met the selected target.' : `Sales ${historical ? 'were' : 'are'} ${money(Math.abs(s.variation))} ${s.variation < 0 ? 'below' : 'above'} target.`,
  ], s.target == null ? 'Confirm the missing target before assessing performance.' : s.variation < 0 ? 'Review customer-wise sales variance and check lost or delayed orders with the RM.' : 'Review the customers and products contributing to target achievement.', s.variation < 0);
  if (s.growthPercent != null) add('momentum', 'Sales Momentum', [`Sales changed by ${s.growthPercent > 0 ? '+' : ''}${s.growthPercent}% against ${money(s.previousActual)} in the comparable period.`, 'The records establish the change, not its cause.'], 'Review order and invoice timing to investigate the change in sales.', s.growthPercent < 0);
  if (k.customersContacted != null) add('engagement', 'Customer Engagement', [`${k.customersContacted} distinct customers ${historical ? 'had' : 'have'} a recorded call or completed visit.`, 'Historical assignments and complete contact coverage are unavailable; uncontacted counts cannot be established.'], 'Review recorded customer contacts and confirm coverage against the assignment list.');
  if (k.visitsCompleted != null) add('visits', 'Field Visit Productivity', [`${k.visitsCompleted} of ${k.visitsPlanned} visits ${historical ? 'had' : 'have'} completion recorded by the cutoff.`, `${Math.max(0, k.visitsPlanned - k.visitsCompleted)} visits ${historical ? 'had' : 'have'} no completion recorded; the records do not establish why.`], 'Review pending visit outcomes and scheduling with the RM.', k.visitsCompleted < k.visitsPlanned);
  if (k.followUpsOpen != null) add('followups', 'Follow-up Execution', [`${k.followUpsOpen} follow-ups ${historical ? 'were' : 'remain'} open; ${k.followUpsOverdue} ${historical ? 'were' : 'are'} overdue as of ${report.asOf}.`, 'Counts refer to follow-ups due within the selected range.'], 'Prioritize overdue customer follow-ups and record the next contact.', k.followUpsOverdue > 0);
  return items.slice(0, 5).map(item => ({ ...item, action: historical ? `This period required review. Recommended retrospective check: ${item.action}` : item.action }));
}
