"use client";
import { useState } from 'react';
import type { RmPerformanceReport } from '../../../shared/rm-performance.mjs';
import { formatDate, formatDateTime } from '@/lib/format';
import { money } from './rm-performance-chart';

export function inputValue(value: string | number | null, column: string) {
  if (value == null || value === '') return 'Not recorded';
  if (typeof value === 'number') return /value/i.test(column) ? money(value) : String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return formatDateTime(/[Zz]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  if (/^(Priority|Follow-up mode|Recorded status|Recorded stage|Request type|Interaction type|Visit tags)$/.test(column)) return value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  return value;
}

const columns = ['Customer', 'Purpose / Priority', 'Product Discussed', 'Visit Outcome / Tags', 'Expected Order Value / Date', 'Next Follow-up Mode / Date', 'Discussion Notes', 'Lead Pipeline'];
const shown = (value: string | number | null | undefined) => value == null || value === '' ? '—' : String(value);
const date = (value: string | null) => {
  if (!value) return '—';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(day.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(day);
};
const moneyValue = (value: number | null) => value == null ? '—' : money(value);
const displayText = (value: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '—';
export function RmMyDayInputs({ report }: { report: RmPerformanceReport }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const entries = report.myDayEntries ?? [];
  const search = query.trim().toLocaleLowerCase();
  const matches = entries.filter(entry => !search || [entry.customer,entry.purpose,entry.priority,entry.product,entry.outcome,entry.tags,entry.expectedValue,entry.expectedDate,entry.followUpMode,entry.followUpDate,entry.notes,entry.relatedNotes,entry.leadStage].some(value => String(value ?? '').toLocaleLowerCase().includes(search)));
  const pageSize = 20;
  const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const pageRows = matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <section id="rm-my-day-inputs" className="rm-v3-dashboard-group rm-inputs" aria-label="RM Save Entries" data-report-section="my-day-inputs">
    <div className="rm-input-table-toolbar"><div><h2>RM Save Entries</h2><p>All customer activities, visit outcomes, expected orders, follow-ups and lead pipeline details in one compact view.</p></div><div className="rm-input-toolbar-right"><label className="rm-input-search"><span className="sr-only">Search saved entries</span><input type="search" value={query} placeholder="Search customer, product, notes..." onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label><span>{matches.length} entries</span></div></div>
    <div className="rm-input-table-scroll"><table className="rm-input-table"><colgroup><col className="customer"/><col className="purpose"/><col className="product"/><col className="outcome"/><col className="order"/><col className="followup"/><col className="notes"/><col className="pipeline"/></colgroup><thead><tr>{columns.map((column, index)=><th key={column} scope="col" className={index === 4 ? 'rm-input-number-cell' : undefined}>{column}</th>)}</tr></thead><tbody>{pageRows.map(entry=><tr key={entry.id}>
      <td className="rm-input-customer" title={shown(entry.customer)}>{shown(entry.customer)}</td>
      <td>{shown(entry.purpose)}{entry.priority && <small className={`rm-input-priority ${['high','medium','low'].includes(entry.priority.toLowerCase()) ? entry.priority.toLowerCase() : ''}`}>{displayText(entry.priority)}</small>}</td>
      <td>{shown(entry.product)}</td>
      <td>{shown(entry.outcome)}{entry.tags && <small title={entry.tags}>{displayText(entry.tags)}</small>}</td>
      <td className="rm-input-number-cell">{moneyValue(entry.expectedValue)}<small>{date(entry.expectedDate)}</small></td>
      <td>{displayText(entry.followUpMode)}<small>{date(entry.followUpDate)}</small></td>
      <td title={[entry.notes,entry.relatedNotes].filter(Boolean).join(' | ')}><span className="rm-input-notes">{shown(entry.notes)}{entry.relatedNotes && entry.relatedNotes !== entry.notes && <small>{entry.relatedNotes}</small>}</span></td>
      <td>{entry.leadStage ? <span className="rm-input-stage">{entry.leadStage.replaceAll('_',' ')}</span> : '—'}</td>
    </tr>)}</tbody></table></div>
    {!matches.length && <p className="rm-v3-inline-state" role="status">{search ? 'No entries match your search.' : report.ownershipMapping !== 'verified' ? 'Saved inputs unavailable until this RM has a unique verified CRM profile.' : 'No saved entries in the selected CRM date range.'}</p>}
    {!!matches.length && <div className="rm-input-pagination"><div><button type="button" disabled={!currentPage} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} of {lastPage+1}</span><button type="button" disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>}
  </section>;
}

/** Same eight saved-entry fields, exported without the UI's search or page window. */
export function savedEntryFields(entry:NonNullable<RmPerformanceReport['myDayEntries']>[number]) {
  return [
    [columns[0],shown(entry.customer)], [columns[1],[shown(entry.purpose),entry.priority?`Priority: ${displayText(entry.priority)}`:''].filter(Boolean).join('\n')],
    [columns[2],shown(entry.product)], [columns[3],[shown(entry.outcome),entry.tags?`Tags: ${displayText(entry.tags)}`:''].filter(Boolean).join('\n')],
    [columns[4],`${moneyValue(entry.expectedValue)}\n${date(entry.expectedDate)}`], [columns[5],`${displayText(entry.followUpMode)}\n${date(entry.followUpDate)}`],
    [columns[6],[shown(entry.notes),entry.relatedNotes&&entry.relatedNotes!==entry.notes?entry.relatedNotes:''].filter(Boolean).join('\n')], [columns[7],displayText(entry.leadStage)],
  ];
}
