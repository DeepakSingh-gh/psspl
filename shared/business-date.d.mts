export type BusinessDateRange = { from: string; to: string };
export type ReportPreset = 'today' | 'week' | 'weekToDate' | 'last30' | 'month' | 'lastMonth' | 'fy';
export function indiaBusinessDate(now?: Date): string;
export function isBusinessDate(value: unknown): value is string;
export function businessDateRange(from: string, to: string): BusinessDateRange;
export function shiftBusinessDate(value: string, days: number): string;
export function reportDateRange(preset: ReportPreset, now?: Date): BusinessDateRange;
