import type { RmPerformanceReport } from '../../shared/rm-performance.mjs';
export const CLIENT_SNAPSHOT_LABEL: string;
export const RAIS_CLIENT_SNAPSHOT: Readonly<Record<string, unknown>>;
export function snapshotValueMissing(value: unknown): boolean;
export function raisKhanClientSnapshot(report: RmPerformanceReport): RmPerformanceReport;
