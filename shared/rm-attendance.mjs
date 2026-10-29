import { indiaBusinessDate } from './business-date.mjs';

// CRM currently stores no employment/leave history or verified absence policy.
// Keep missing records unverified until an authoritative policy is supplied.
export const ATTENDANCE_POLICY = Object.freeze({ weeklyHolidays: [0], absenceVerified: false });
const isoDay = value => new Date(value).toISOString().slice(0, 10);
const stamp = value => {
  if (!value) return null;
  // SQLite CURRENT_TIMESTAMP is UTC; never interpret it in the host timezone.
  const text = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
};

export function attendanceMonths({ financialYear, cutoff, today, rows = [], available = true, policy = ATTENDANCE_POLICY }) {
  const startYear = Number(financialYear.slice(0, 4));
  const seen = new Set(), grouped = new Map();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const list = grouped.get(row.business_date) ?? [];
    list.push(row); grouped.set(row.business_date, list);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const first = new Date(Date.UTC(startYear, index + 3, 1));
    const key = isoDay(first).slice(0, 7);
    const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const days = Array.from({ length }, (_, i) => {
      const date = `${key}-${String(i + 1).padStart(2, '0')}`;
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const holiday = policy.weeklyHolidays.includes(weekday) || (policy.holidays ?? []).includes(date);
      const due = date <= cutoff && date < today;
      const scheduled = available && due && policy.absenceVerified && policy.employmentFrom && date >= policy.employmentFrom && (!policy.employmentTo || date <= policy.employmentTo) && policy.coverageFrom && date >= policy.coverageFrom && policy.coverageTo && date <= policy.coverageTo;
      const sessions = (available && date <= cutoff ? grouped.get(date) ?? [] : []).map(row => {
        const begin = stamp(row.check_in_at), end = stamp(row.check_out_at);
        const valid = begin != null && indiaBusinessDate(new Date(begin)) === date;
        const endVisible = end != null && indiaBusinessDate(new Date(end)) <= cutoff;
        return { checkInAt: row.check_in_at ?? null, checkOutAt: endVisible ? row.check_out_at : null, valid,
          invalidClockOut: Boolean(row.check_out_at) && (end == null || (begin != null && end < begin)),
          incomplete: valid && (!endVisible || end < begin), checkoutAfterCutoff: end != null && !endVisible,
          interval: valid && endVisible && end >= begin ? [begin, end] : null };
      });
      const intervals = sessions.flatMap(s => s.interval ? [s.interval] : []).sort((a,b) => a[0] - b[0]);
      let workedMs = 0, intervalEnd = -Infinity;
      for (const [a,b] of intervals) { workedMs += Math.max(0, b - Math.max(a, intervalEnd)); intervalEnd = Math.max(intervalEnd, b); }
      const present = sessions.some(s => s.valid);
      const status = present ? 'present' : date > cutoff || date > today ? 'upcoming' : holiday ? 'holiday' : scheduled && !sessions.length ? 'absent' : 'unverified';
      return { date, weekday, holiday, status, workedHoliday: present && holiday,
        eligible: Boolean(scheduled && !holiday), workedMinutes: intervals.length ? workedMs / 60000 : null,
        incompleteCount: sessions.filter(s => s.incomplete).length,
        sessions: sessions.map(({ interval, ...s }) => s) };
    });
    const eligible = days.filter(d => d.eligible);
    const denominatorKnown = available && policy.absenceVerified && eligible.length > 0 && !eligible.some(d => d.status === 'unverified');
    const summary = {
      present: available ? days.filter(d => d.status === 'present').length : null,
      absent: denominatorKnown ? days.filter(d => d.status === 'absent').length : null,
      holidays: days.filter(d => d.holiday && d.date <= cutoff && d.date <= today).length,
      eligibleWorkingDays: denominatorKnown ? eligible.length : null,
      attendancePercent: denominatorKnown ? eligible.filter(d => d.status === 'present').length / eligible.length * 100 : null,
      workedMinutes: days.some(d => d.workedMinutes != null) ? days.reduce((sum,d) => sum + (d.workedMinutes ?? 0), 0) : null,
      incompleteCount: available ? days.reduce((sum,d) => sum + d.incompleteCount, 0) : null,
      unverified: days.filter(d => d.status === 'unverified').length,
    };
    return { key, from: `${key}-01`, to: `${key}-${length}`, days, summary };
  });
}
