import type { RmReportSelection } from './rm-report-period.mjs';
import type { AttendanceReport } from './rm-attendance.mjs';
export interface ThrustYtdReport { from: string; to: string; companyNetSales: number | null; note: string; demo?: {companyNetSales:number;version:string}; products: Array<{ id: string; name: string; sales: number | null; companyContributionPercent: number | null; clientSnapshot?: boolean; demoMetrics?: {sales:number;companyContributionPercent:number;companyNetSales:number;version:string} }> }
export interface Variation {
  actual: number | null; target: number | null; previousActual: number | null;
  achievementPercent: number | null; variation: number | null; variationPercent: number | null; growthPercent: number | null;
}
export interface PerformanceRow extends Variation { key: string; label: string; from: string; to: string; month?: number; week?: number; source: string; targetBasis: string; partial: boolean; clientSnapshotFields?: string[] }
export interface ReportTable { id: string; title: string; note?: string; columns: string[]; rows: Array<Array<string | number | null>> }
export interface RmMyDayEntry { id: string; customer: string | null; purpose: string | null; priority: string | null; product: string | null; outcome: string | null; tags: string | null; expectedValue: number | null; expectedDate: string | null; followUpMode: string | null; followUpDate: string | null; notes: string | null; relatedNotes?: string | null; leadStage: string | null }
export interface PerformanceNarrative { id: string; title: string; points: string[]; action: string; priority: string; reason: string }
export interface RmPerformanceReport {
  version: 2; id: string; name: string; rmCode: string | null; region: string | null; territory: string | null; operatingFrom: string | null;
  selectedPeriod: RmReportSelection; from: string; to: string; asOf: string; historical: boolean; future: boolean; reportLabel: string;
  financialYears: string[]; ownershipMapping: string; source: string; sourceAsOf: string | null; lastSyncAt: string | null; limitations: string[]; weekRule: string;
  summary: Variation; annualTarget: number | null; comparison: { from: string; to: string; label: string } | null;
  kpi: { actualSalesValue: number | null; targetValue: number | null; achievementPercent: number | null; visitsPlanned: number | null; visitsCompleted: number | null; callsLogged: number | null; customersContacted: number | null; followUpsOpen: number | null; followUpsOverdue: number | null; expectedOrdersValue: number | null };
  topSales?: { customerDemo?: { label: string; version: string }; productDemo?: { label: string; version: string }; totalSales: number | null; customers: Array<{ id: string; name: string; salesValue: number; sharePercent: number | null; sample?: boolean }>; products: Array<{ id: string; name: string; salesValue: number; sharePercent: number | null }>; customerTotal?: number; productTotal?: number; productVariance?: number; shareReason?: string | null; reason?: string | null };
  activeDealerCount: number | null; yearRows: PerformanceRow[]; weekRows: PerformanceRow[]; periodChartRows: PerformanceRow[];
  technicalService?: { center?: string | null; executive?: string | null };
  executiveTerritoryCoverage: { asOf?: string; entries: Array<{ name: string; citiesCovered: string }> } | null;
  team: Array<{ name: string; territory: string | null }>;
  tables: ReportTable[]; myDayTables?: ReportTable[]; myDayEntries?: RmMyDayEntry[]; inputDemo?: boolean; narratives: PerformanceNarrative[];
  myDayRange?: { from: string; to: string };
  salespeople?: Array<{ id: string; name: string; territory: string | null }>;
  selectedSalespersonId?: string | null;
  manager?: { id: string; name: string };
  attendance?: AttendanceReport;
  attendanceMonth?: string;
  clientDemo?: {label:string;version:string;scope:string};
  thrustYtd?: ThrustYtdReport;
  territoryExpansion?: string;
  clientSnapshotFallback?: { label: string; fields: string[]; conflicts: Array<{field:string;existing:unknown;snapshot:unknown}>; warnings: string[]; originalSummary: Variation };
  myDaySummary?: { visitsPlanned: number | null; visitsCompleted: number | null; callsLogged: number | null; followUpsOpen: number | null; followUpsOverdue: number | null; expectedOrdersValue: number | null };
  analysisMethod?: 'rule-based' | 'ai-assisted'; analysisNote?: string;
}
export const WEEK_RULE: string;
export function round(value: number): number | null;
export function variations(actual: number | null, target: number | null, previousActual?: number | null): Variation;
export function financialMonths(financialYear: string): Array<{ month: number; from: string; to: string; key: string; label: string }>;
export function reportingWeeks(financialYear: string, month: number): Array<{ week: number; from: string; to: string; key: string; label: string }>;
export function comparisonRange(selection: RmReportSelection, cutoff: string): { from: string; to: string; label: string } | null;
export function performanceNarratives(report: RmPerformanceReport): PerformanceNarrative[];
