"use client";
import { useState, type ReactNode } from 'react';
import type { ReportTable, RmPerformanceReport } from '../../../shared/rm-performance.mjs';
import { executiveReviews } from '@/lib/rm-executive-review';
import { ThrustProductsGrid } from './rm-thrust-products';
import { RmTopSales } from './rm-top-sales';
import { SnapshotFieldBadge } from './client-snapshot-badge';
import { formatDate } from '@/lib/format';
import { money, percent } from './rm-performance-chart';

export function ReportIdentity({ report, controls, document = false }: { report: RmPerformanceReport; controls?: ReactNode; document?: boolean }) {
  const grouped = new Map<string, string[]>();
  for (const entry of report.executiveTerritoryCoverage?.entries ?? []) {
    const cities = grouped.get(entry.name) ?? [];
    if (!cities.includes(entry.citiesCovered)) cities.push(entry.citiesCovered);
    grouped.set(entry.name, cities);
  }
  const coverage = <div className="rm-v3-coverage-content">
    <div><h3>Current verified assignments</h3><p>{report.team.length ? report.team.map(t => `${t.name}${t.territory ? ` · ${t.territory}` : ''}`).join('; ') : 'No verified assigned executives.'}</p></div>
    <section aria-label="Executive Territory Coverage"><h3>Supplied report coverage {report.executiveTerritoryCoverage?.asOf && <span>· {formatDate(report.executiveTerritoryCoverage.asOf)}</span>}</h3>
      {report.territoryExpansion&&<p>Territory expansion: {report.territoryExpansion} <SnapshotFieldBadge report={report} field="territoryExpansion"/></p>}
      {grouped.size ? <div className="rm-v3-coverage-list">{Array.from(grouped, ([name, cities]) => <div key={name}><strong>{name}</strong><span>{cities.join('; ')}</span></div>)}</div> : <p>Source territory mapping unavailable.</p>}
      
    </section>
    {report.technicalService && <section aria-label="Technical service"><h3>Technical service</h3><p>{report.technicalService.center ?? 'Center unavailable'}<SnapshotFieldBadge report={report} field="technicalService.center"/>{report.technicalService.executive ? ` · ${report.technicalService.executive}` : ''}<SnapshotFieldBadge report={report} field="technicalService.executive"/></p></section>}
  </div>;
  return <section className="rm-v2-identity" aria-label="RM identity and coverage">
    <div className="rm-v3-header-main">
      <div className="rm-v3-profile"><p className="rm-v2-eyebrow">{report.selectedSalespersonId?'Salesperson':'Regional manager'} / performance report</p><h1>{report.name}<SnapshotFieldBadge report={report} field="name"/></h1><p className="rm-v3-profile-meta"><strong>{report.rmCode ?? 'Employee code unavailable'}<SnapshotFieldBadge report={report} field="rmCode"/></strong><span>{report.operatingFrom ?? 'City unavailable'}<SnapshotFieldBadge report={report} field="operatingFrom"/></span><span>{report.region ?? 'Region unavailable'}{report.territory ? ` / ${report.territory}` : ''}<SnapshotFieldBadge report={report} field="territory"/></span>{report.selectedSalespersonId&&<span>Reports to {report.manager?.name}</span>}</p></div>
      {controls ?? <div className="rm-v2-context"><strong>{report.reportLabel}</strong><span>{formatDate(report.from)} to {formatDate(report.to)}</span><span>Data as of {formatDate(report.asOf)}</span></div>}
    </div>
    {document ? coverage : <details className="rm-v3-coverage"><summary>Coverage & technical service <span>{report.team.length} current executive{report.team.length === 1 ? '' : 's'}{grouped.size ? ` · ${grouped.size} source coverage entries` : ''}</span><span className="rm-v3-disclosure-label">Show details</span></summary>{coverage}</details>}
  </section>;
}

export function PerformanceSummary({ report }: { report: RmPerformanceReport }) {
  const s = report.summary, k = report.kpi;
  const demoPreview = Boolean(report.clientDemo || report.clientSnapshotFallback);
  const crm=report.myDaySummary??k;
  const crmDate=formatDate(report.myDayRange?.to??report.asOf);
  const achievement = s.achievementPercent ?? (demoPreview && s.actual != null && s.target ? s.actual / s.target * 100 : null);
  const variation = s.variation ?? (demoPreview && s.actual != null && s.target != null ? s.actual - s.target : null);
  const cards = [
    { label: report.selectedPeriod.reportType === 'yearly' && !report.historical ? 'Target through cutoff' : 'Sales target', value: money(s.target), context: `Through ${formatDate(report.asOf)}` },
    { label: 'Actual sales', value: money(s.actual), context: report.selectedPeriod.reportType === 'yearly' ? 'Recorded sales to cutoff' : 'Selected period net sales' },
    { label: 'Achievement', value: achievement == null ? 'N/A' : `${achievement.toFixed(2)}%`, context: s.target == null ? 'Verified target unavailable' : 'Of selected target' },
    { label: variation != null && variation >= 0 ? 'Target surplus' : 'Target gap', value: money(variation == null ? null : Math.abs(variation)), tone: variation == null ? '' : variation < 0 ? 'negative' : 'positive', context: variation == null ? 'Comparison unavailable' : variation < 0 ? 'Below planned revenue' : 'Above planned revenue' },
    { label: 'Previous comparable sales', value: s.previousActual == null && demoPreview ? '₹41.93 L' : money(s.previousActual), context: s.previousActual == null ? demoPreview ? 'Demo data' : 'Comparable period unavailable' : report.comparison ? `${formatDate(report.comparison.from)}–${formatDate(report.comparison.to)}` : 'Comparable period unavailable' },
    { label: 'Sales growth', value: s.growthPercent == null && demoPreview ? '+14.07%' : percent(s.growthPercent), tone: s.growthPercent == null || s.growthPercent >= 0 ? 'positive' : 'negative', context: s.growthPercent == null ? demoPreview ? 'Demo data' : 'Versus comparable period' : 'Versus comparable period' },
    { label: 'Customer visits', value: crm.visitsCompleted == null ? 'N/A' : `${crm.visitsCompleted} / ${crm.visitsPlanned}`, context: `Completed / planned · CRM through ${crmDate}` },
    { label: 'Pending follow-ups', value: crm.followUpsOpen ?? (demoPreview ? 8 : 'N/A'), context: crm.followUpsOpen == null ? demoPreview ? 'Demo data' : 'Historical status unavailable' : `${crm.followUpsOverdue ?? 0} overdue · CRM through ${crmDate}` },
  ];
  const paths=['summary.target','summary.actual','summary.achievementPercent','summary.variation','summary.previousActual','summary.growthPercent','',''];
  return <section aria-label="Performance summary" className="rm-v2-summary"><div className="rm-v3-section-label"><h2>Performance overview</h2><span>{report.selectedPeriod.reportType === 'yearly' ? `Annual target ${money(report.annualTarget)}` : report.reportLabel}<SnapshotFieldBadge report={report} field="annualTarget"/></span></div>
    <div className="rm-v2-kpis">{cards.map((c, index) => <article key={c.label} className={index < 4 ? 'primary' : ''}><span>{c.label}</span><strong className={c.tone}>{c.value}</strong><SnapshotFieldBadge report={report} field={paths[index]}/></article>)}</div>
  </section>;
}

export function reportCell(value: string | number | null, column: string): ReactNode {
  if (value == null) return 'N/A';
  if (typeof value === 'number') return /sales|value/i.test(column) ? money(value) : value.toLocaleString('en-IN');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return value;
}

export function PerformanceTable({ table, limit = 5, quietEmpty = false }: { table: ReportTable; limit?: number; quietEmpty?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!table.rows.length) return quietEmpty ? null : <p className="rm-v3-inline-state">{table.title}: no reliable detail available for this period.</p>;
  const numeric = (index: number) => table.rows.some(row => typeof row[index] === 'number');
  const rows = expanded ? table.rows : table.rows.slice(0, limit);
  return <section className="rm-v3-table-section" data-report-section={table.id}><div className="rm-v3-subheading"><h3>{table.title}</h3><span>{table.rows.length} record{table.rows.length === 1 ? '' : 's'}</span></div>
    <div className="rm-v2-table-scroll"><table><thead><tr>{table.columns.map((c, i) => <th key={c} scope="col" className={numeric(i) ? 'numeric' : undefined}>{c}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((v, i) => <td key={i} className={numeric(i) ? 'numeric' : undefined}>{reportCell(v, table.columns[i])}</td>)}</tr>)}</tbody></table></div>
    {table.rows.length > limit && <button type="button" className="rm-v3-text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer records' : `Show all ${table.rows.length} records`}</button>}
    {table.note && <details className="rm-v3-table-note"><summary>Source note</summary><p>{table.note}</p></details>}
  </section>;
}

function MetricStrip({ metrics }: { metrics: Array<[string, ReactNode]> }) {
  return <dl className="rm-v3-metric-strip">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function PerformanceDetails({ report }: { report: RmPerformanceReport }) {
  const table = (id: string) => report.tables.find(t => t.id === id);
  const k = report.kpi;
  return <>
    <section className="rm-v3-dashboard-group" aria-label="Business performance details">
      <RmTopSales report={report}/>
      <ThrustProductsGrid data={report.thrustYtd}/>
    </section>
  </>;
}


export function PerformanceInsights({ report }: { report: RmPerformanceReport }) {
  const reviews = executiveReviews(report);
  return <section className="rm-v3-dashboard-group" data-report-section="insights"><div className="rm-v3-section-label"><h2>AI Insights</h2><span className="rm-v3-method">{report.analysisMethod === 'ai-assisted' ? 'AI-assisted priority' : 'Rule-based findings'}</span></div><p className="rm-v3-analysis-source">{report.analysisMethod === 'ai-assisted' ? 'AI prioritizes verified findings; figures and recommendations remain server-controlled.' : 'Verified metrics and deterministic findings; no LLM-generated analysis is claimed.'}{report.analysisNote && <span> AI review unavailable; verified fallback shown.</span>}</p>
    <div className="rm-v3-insight-grid">{reviews.map((n, i) => <article className={`rm-v3-insight-card ${!n.available ? 'unavailable' : ''}`} key={n.id}><div className="rm-v3-insight-title"><span className="rm-v3-insight-number">{String(i + 1).padStart(2, '0')}</span><h3>{n.title}</h3></div><span className={`rm-v3-status ${n.priority === 'High' ? 'attention' : ''}`}>{!n.available ? 'Unavailable' : n.priority === 'High' ? 'Attention' : 'Review'}</span><ul>{n.points.map(p => <li key={p}>{p}</li>)}</ul></article>)}</div>
  </section>;
}

export function PerformanceActions({ report }: { report: RmPerformanceReport }) {
  const reviews = executiveReviews(report).sort((a, b) => (a.priority === 'High' ? 0 : a.available ? 1 : 2) - (b.priority === 'High' ? 0 : b.available ? 1 : 2));
  return <section className="rm-v3-dashboard-group" data-report-section="actions"><div className="rm-v3-section-label"><h2>Manager Action Plan{report.historical ? ' — Historical' : ''}</h2><span>Evidence → recommended response</span></div>
    <div className="rm-v3-action-matrix">{reviews.map(n => <article className={`rm-v3-action-row ${n.priority === 'High' ? 'high' : ''}`} key={n.id}><div className="rm-v3-action-issue"><span className={`rm-v3-priority ${n.priority.toLowerCase()}`}>{n.priority}</span><h3>{n.actionTitle}</h3></div><p className="rm-v3-action-evidence"><span>Evidence</span>{n.evidence}</p><div className="rm-v3-action-response"><span>{report.historical ? 'Next Steps' : 'Recommended response'}</span>{n.responses.length ? <ul>{n.responses.map(p => <li key={p}>{p}</li>)}</ul> : <p>No period-specific recommendation without reliable evidence.</p>}</div></article>)}</div>
  </section>;
}

