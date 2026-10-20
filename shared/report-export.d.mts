import type { ReactElement } from 'react';
export function safeSpreadsheetCell(value: unknown): string;
export function reportCsv(lines: unknown[][]): string;
export function reportExcelCell(value: unknown): string;
export function reportExcelTable(headings: string[], rows: unknown[][]): string;
export function FullSalesReportPrint(props: { headings: string[]; rows: unknown[][]; from: string; to: string; filters: string[]; totalSales: number }): ReactElement;
