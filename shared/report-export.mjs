import { createElement as h } from 'react';

export function safeSpreadsheetCell(value) {
  const text = String(value ?? '');
  return typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function reportCsv(lines) {
  return lines.map(line => line.map(value => `"${safeSpreadsheetCell(value).replaceAll('"', '""')}"`).join(',')).join('\n');
}

export function reportExcelCell(value) {
  return safeSpreadsheetCell(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function reportExcelTable(headings, rows) {
  return `<table><tr>${headings.map(value=>`<th>${reportExcelCell(value)}</th>`).join('')}</tr>${rows.map(row=>`<tr>${row.map(value=>`<td>${reportExcelCell(value)}</td>`).join('')}</tr>`).join('')}</table>`;
}

// The print tree receives the complete report, independently of screen pagination.
export function FullSalesReportPrint({ headings, rows, from, to, filters, totalSales }) {
  return h('section', { className: 'sales-report-print', 'aria-label': 'Complete filtered sales report' },
    h('h2', null, 'Progressive Surface Systems sales report'),
    h('p', null, `Authoritative Tally | ${from} to ${to} | INR total: ${totalSales}`),
    h('p', null, `Filters: ${filters.join('; ') || 'None'} | ${rows.length} aggregate rows`),
    h('table', { className: 'admin-table' },
      h('thead', null, h('tr', null, headings.map((name,index)=>h('th',{key:index},name)))),
      h('tbody', null, rows.map((row,index)=>h('tr',{key:index},row.map((value,column)=>h('td',{key:column},String(value??''))))))));
}
