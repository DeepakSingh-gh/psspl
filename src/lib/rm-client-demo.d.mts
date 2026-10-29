import type { RmPerformanceReport } from '../../shared/rm-performance.mjs';
export const REPORT_DEMO_VERSION: string;
export function canUseLocalReportPreview(context:{role?:string|null;audience?:string;hostname?:string}): boolean;
export function localReportPreview(report:RmPerformanceReport,options?:{enabled?:boolean;role?:string|null;audience?:string;hostname?:string;today?:string;version?:string}): RmPerformanceReport;
