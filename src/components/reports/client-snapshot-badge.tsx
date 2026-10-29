import type { RmPerformanceReport } from '../../../shared/rm-performance.mjs';

export function ClientSnapshotBadge(_props:{visible?:boolean}) {
  return null;
}
export function SnapshotFieldBadge({report,field}:{report:RmPerformanceReport;field:string}) {
  return <ClientSnapshotBadge visible={report.clientSnapshotFallback?.fields.includes(field)}/>;
}
  