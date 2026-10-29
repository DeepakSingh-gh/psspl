export type WeeklyChartRow = { month: string; label: string; from: string; to: string; target: number | null; actual: number | null; achievementPercent: number | null };
export function rmMonthlyChart(data: any): { rows: WeeklyChartRow[]; demo: boolean; month: string };
