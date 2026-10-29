"use client";
import { useEffect, useId, useRef, useState } from 'react';
import type { PerformanceRow, RmPerformanceReport } from '../../../shared/rm-performance.mjs';
import { formatDate, formatRupees } from '@/lib/format';
import { ClientSnapshotBadge } from './client-snapshot-badge';
import { CLIENT_SNAPSHOT_LABEL } from '@/lib/rais-khan-client-snapshot.mjs';

export const money = (value: number | null | undefined) => value == null ? 'N/A' : formatRupees(value);
export const percent = (value: number | null | undefined) => value == null ? 'N/A' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const signedMoney = (value: number | null) => value == null ? 'N/A' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;

export function PerformanceTooltip({ row }: { row: PerformanceRow }) {
  return <div className="rm-v2-tooltip" role="status" aria-live="polite">
    <strong>{row.label} · {formatDate(row.from)} to {formatDate(row.to)}</strong>
    <dl>{[
      ['Target', money(row.target)], ['Actual sales', money(row.actual)],
      ['Achievement', row.achievementPercent == null ? 'N/A' : `${row.achievementPercent.toFixed(2)}%`],
      ['Target variation', signedMoney(row.variation)], ['Target variation %', percent(row.variationPercent)],
      ['Previous comparable sales', money(row.previousActual)], ['Period growth', percent(row.growthPercent)],
    ].map(([label,value],index)=><div key={label}><dt>{label}</dt><dd className={label.startsWith('Target variation') ? row.variation == null || row.variation === 0 ? '' : row.variation < 0 ? 'negative' : 'positive' : ''}>{value}<ClientSnapshotBadge visible={row.clientSnapshotFields?.includes(['target','actual','achievementPercent','variation','variationPercent','previousActual','growthPercent'][index])}/></dd></div>)}</dl>
    <small>{row.source}{row.partial ? ' · Partial period actuals' : ''}<span title={row.targetBasis}> · Target basis</span></small>
  </div>;
}

/** Same signed, null-preserving bars are used for the static PDF chart. */
export function PerformanceBars({ rows, selectedKey, onSelect, onInspect, compact = false, staticChart = false }: {
  rows: PerformanceRow[]; selectedKey?: string; onSelect?: (row: PerformanceRow)=>void;
  onInspect?: (row: PerformanceRow)=>void; compact?: boolean; staticChart?: boolean;
}) {
  const titleId=useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(rows.length <= 4 ? 480 : 760);
  useEffect(() => {
    if (staticChart || !container.current) return;
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setWidth(previous => Math.abs(previous - next) > 1 ? next : previous);
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [staticChart]);
  const values=rows.flatMap(r=>[r.actual ?? 0,r.target ?? 0]);
  const ceiling=Math.max(1,...values)*1.15, floor=Math.min(0,...values)*1.15;
  const w=staticChart?726:width,h=staticChart?210:250,left=68,bottom=37,top=18,plot=h-top-bottom;
  const y=(v:number)=>top+(ceiling-v)/(ceiling-floor)*plot;
  const step=(w-left-14)/Math.max(1,rows.length),bar=Math.min(20,step*0.29);
  return <div ref={container} className={`rm-v2-bars ${compact?'compact':''}`}>
    <svg viewBox={`0 0 ${w} ${h}`} role={staticChart?'img':'group'} aria-labelledby={titleId} style={{width:'100%',height:h,display:'block'}}>
      <title id={titleId}>Net sales versus target in rupees. Missing figures are N/A.</title>
      {[0,.25,.5,.75,1].map(r=>{
        const v=floor+(ceiling-floor)*r;
        return <g key={r}><line x1={left} x2={w-14} y1={y(v)} y2={y(v)} stroke="#e2e8f0"/><text x={left-7} y={y(v)+4} fontSize="11" textAnchor="end" fill="#64748b">{money(v)}</text></g>;
      })}
      <line x1={left} x2={w-14} y1={y(0)} y2={y(0)} stroke="#64748b"/>
      {rows.map((row,i)=>{
        const x=left+step*i+step/2, active=selectedKey===row.key;
        const activate=()=>{onInspect?.(row);onSelect?.(row);};
        return <g key={row.key} role={staticChart?'group':'button'} tabIndex={staticChart?undefined:0}
          aria-label={`${row.label}: target ${money(row.target)}, actual ${money(row.actual)}${row.clientSnapshotFields?.length?`. ${CLIENT_SNAPSHOT_LABEL}`:''}${staticChart?'':'. Select reporting context.'}`} aria-pressed={staticChart?undefined:active}
          onClick={staticChart?undefined:activate} onFocus={()=>onInspect?.(row)} onMouseEnter={()=>onInspect?.(row)}
          onKeyDown={e=>{if(!staticChart&&(e.key==='Enter'||e.key===' ')){e.preventDefault();activate();}}}>
          <rect className="rm-v2-bar-hit" x={x-step/2+2} y={top-3} width={step-4} height={h-top-3} rx="5" fill={active?'#e0f2fe':'transparent'} stroke={active?'#0284c7':'transparent'}/>
          {[{value:row.target,x:x-bar-1,color:'#94a3b8'},{value:row.actual,x:x+1,color:row.variation!=null&&row.variation>=0?'#16a34a':'#0284c7'}].map((v,j)=>v.value==null?null:
            <rect key={j} x={v.x} y={Math.min(y(0),y(v.value))} width={bar} height={Math.max(1,Math.abs(y(0)-y(v.value)))} fill={v.color} rx="2" style={{pointerEvents:'none'}}/>)}
          <text x={x} y={h-15} textAnchor="middle" fontSize="11" fontWeight={active?800:500} fill={active?'#0369a1':'#475569'}>{row.label}</text>
        </g>;
      })}
    </svg>
    <div className="rm-v2-legend"><span>■ Target</span><span style={{color:'#0284c7'}}>■ Actual<small style={{display:'block',marginLeft:'1em',fontSize:'0.85em'}}>(&lt;100%)</small></span><span style={{color:'#15803d'}}>■ Target met<small style={{display:'block',marginLeft:'1em',fontSize:'0.85em'}}>({'\u2265'}100%)</small></span><span>Missing bars = unavailable / future</span>{rows.some(row=>row.clientSnapshotFields?.length)&&<span><ClientSnapshotBadge visible/> {rows.filter(row=>row.clientSnapshotFields?.length).map(row=>row.label).join(', ')}</span>}</div>
  </div>;
}

export function RmPerformanceChart({yearReport, activeReport, month, week, loading, onMonth, onWeek, onReset, onBackMonth}: {
  yearReport: RmPerformanceReport; activeReport: RmPerformanceReport | null; month?: number; week?: number; loading: boolean;
  onMonth:(month:number)=>void;onWeek:(week:number)=>void;onReset:()=>void;onBackMonth:()=>void;
}) {
  const [inspected,setInspected]=useState<PerformanceRow|null>(null);
  useEffect(() => { setInspected(null); }, [activeReport?.from, activeReport?.to]);
  const validInspection=inspected&&yearReport.yearRows.some(row=>row.key===inspected.key)?yearReport.yearRows.find(row=>row.key===inspected.key):activeReport?.weekRows.find(row=>row.key===inspected?.key);
  const nextContext = validInspection ?? (activeReport ? {
    ...activeReport.summary, key:'active-context', label:activeReport.reportLabel,
    from:activeReport.from,to:activeReport.to,source:activeReport.source,targetBasis:'Selected report target',partial:!activeReport.historical,
    clientSnapshotFields:activeReport.clientSnapshotFallback?.fields.filter(field=>field.startsWith('summary.')).map(field=>field.slice(8)),
  } : null);
  const previousContext = useRef<PerformanceRow | null>(null);
  if (nextContext) previousContext.current = nextContext;
  const context = nextContext ?? previousContext.current;
  return <section className="rm-v2-section rm-v2-chart" aria-label="Interactive sales navigation">
    <div className="rm-v2-section-heading"><div><span className="rm-v3-chart-eyebrow">Sales performance</span><h2>Yearly Sales vs Target — FY {yearReport.selectedPeriod.financialYear}</h2><p>Select a month to explore its four reporting weeks.</p></div>
      {month&&<button type="button" onClick={()=>{setInspected(null);onReset();}}>Back to Full Year</button>}</div>
    <div className={`rm-v2-chart-split ${month?'expanded':''}`}>
      <div className="rm-v2-month-chart"><PerformanceBars rows={yearReport.yearRows} selectedKey={yearReport.yearRows.find(row=>row.month===month)?.key} compact={!!month} onSelect={row=>onMonth(row.month!)} onInspect={setInspected}/></div>
      <div className="rm-v2-week-chart" aria-hidden={!month}>
        {month&&<div className="rm-v2-week-inner"><div className="rm-v2-section-heading"><h3>{yearReport.yearRows.find(row=>row.month===month)?.label} reporting weeks</h3>{week&&<button type="button" onClick={onBackMonth}>Back to month</button>}</div>
          {activeReport?<PerformanceBars rows={activeReport.weekRows} selectedKey={week?`week-${week}`:undefined} onSelect={row=>onWeek(row.week!)} onInspect={setInspected}/>:<div className="rm-v2-chart-loading" role="status">Loading weekly records…</div>}
        </div>}
      </div>
    </div>
    <div className={`rm-v2-chart-details rm-v3-period-content ${loading?'pending':''}`} aria-busy={loading}><div aria-hidden={loading}>{context?<PerformanceTooltip row={context}/>:<p>Period details are loading.</p>}</div>{loading&&<p className="rm-v3-update-status" role="status">Updating period details…</p>}</div>
    {loading&&<p role="status">Updating report context…</p>}
  </section>;
}
