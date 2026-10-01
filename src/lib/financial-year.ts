/**
 * Indian financial year helpers (Apr 1 – Mar 31).
 * Required reporting period is FY2021-22 onward, including the running FY.
 */

export interface FinancialYearOption {
  id: string; // "2021-22"
  label: string; // "FY 2021–22"
  startDate: string; // ISO
  endDate: string; // ISO
}

export function getFinancialYearId(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, 3 = April
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYearShort}`;
}

export function listFinancialYears(
  fromStartYear: number = 2021,
  today: Date = new Date()
): FinancialYearOption[] {
  const currentFyId = getFinancialYearId(today);
  const currentStartYear = parseInt(currentFyId.split("-")[0], 10);

  const options: FinancialYearOption[] = [];
  for (let startYear = fromStartYear; startYear <= currentStartYear; startYear++) {
    const endYearShort = (startYear + 1).toString().slice(-2);
    options.push({
      id: `${startYear}-${endYearShort}`,
      label: `FY ${startYear}–${endYearShort}`,
      startDate: `${startYear}-04-01`,
      endDate: `${startYear + 1}-03-31`,
    });
  }
  return options.reverse(); // most recent first
}

export function getCurrentFinancialYearId(today: Date = new Date()): string {
  return getFinancialYearId(today);
}
