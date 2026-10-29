export type RmReportSelection = { reportType: 'weekly' | 'monthly' | 'yearly'; financialYear: string; month?: number | string; week?: number | string; weekScheme?: 'calendar' | 'four' };
export function rmReportPeriod(selection: RmReportSelection): { from: string; to: string; reportType: RmReportSelection['reportType']; financialYear: string; label: string };
export function targetForRange(targets: Map<string, number>, from: string, to: string): number | null;
