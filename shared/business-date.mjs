/** India calendar dates are independent of browser/server timezone. Instants remain UTC. */
export function indiaBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function isBusinessDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function businessDateRange(from, to) {
  if (!isBusinessDate(from) || !isBusinessDate(to) || from > to) throw new RangeError('Choose a valid report date range');
  return { from, to };
}

export function shiftBusinessDate(value, days) {
  if (!isBusinessDate(value) || !Number.isInteger(days)) throw new RangeError('Choose a valid calendar date and day offset');
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reportDateRange(preset, now = new Date()) {
  const to = indiaBusinessDate(now), year = Number(to.slice(0, 4)), month = Number(to.slice(5, 7));
  if (preset === 'today') return { from: to, to };
  if (preset === 'week') return { from: shiftBusinessDate(to, -6), to }; // explicitly rolling seven days
  if (preset === 'weekToDate') {
    const weekday = new Date(`${to}T00:00:00Z`).getUTCDay();
    return { from: shiftBusinessDate(to, -((weekday + 6) % 7)), to }; // existing RM Monday convention
  }
  if (preset === 'last30') return { from: shiftBusinessDate(to, -29), to };
  if (preset === 'month') return { from: `${to.slice(0, 7)}-01`, to };
  if (preset === 'lastMonth') {
    const end = shiftBusinessDate(`${to.slice(0, 7)}-01`, -1);
    return { from: `${end.slice(0, 7)}-01`, to: end };
  }
  if (preset === 'fy') return { from: `${year - (month < 4 ? 1 : 0)}-04-01`, to };
  throw new RangeError('Unsupported reporting preset');
}
