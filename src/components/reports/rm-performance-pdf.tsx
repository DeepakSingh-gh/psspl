"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RmPerformanceReport } from '../../../shared/rm-performance.mjs';
import { PerformanceBars } from './rm-performance-chart';
import { ReportIdentity, PerformanceSummary, reportCell } from './rm-performance-view';
import { formatDate } from '@/lib/format';
import { executiveReviews } from '@/lib/rm-executive-review';
import { AttendanceSummary, attendanceMonthLabel, defaultAttendanceMonth } from './rm-attendance';
import { ThrustProductCells } from './rm-thrust-products';
import { RmTopSales } from './rm-top-sales';
import { ClientSnapshotBadge } from './client-snapshot-badge';
import { RmAttendanceHeatmap } from './rm-attendance-heatmap';
import { savedEntryFields } from './rm-my-day-inputs';
import { paginatePdfBlocks } from './rm-pdf-pagination';

interface PdfBlock { key: string; content: ReactNode; keepNext?: boolean; continuationKey?: string; continuationContent?: ReactNode; insight?: ReactNode; fullWidthInsight?: boolean }
const PAGE_HEIGHT = 1122;

function PageHeader({ report }: { report: RmPerformanceReport }) {
  return <header className="rm-v2-pdf-header"><strong>PROGRESSIVE SURFACE SYSTEMS{report.inputDemo ? ' · DEMO INPUTS' : ''}<ClientSnapshotBadge visible={!!report.clientSnapshotFallback}/></strong><span>{report.name} · {report.reportLabel}</span></header>;
}

function PageFooter({ report, page, count }: { report: RmPerformanceReport; page: number; count: number }) {
  return <footer className="rm-v2-pdf-footer"><span>{formatDate(report.from)} to {formatDate(report.to)} · Financial cutoff {formatDate(report.asOf)} · CRM through {formatDate(report.myDayRange?.to??report.asOf)}</span><span>Page {page} of {count}</span></footer>;
}

function reportBlocks(report:RmPerformanceReport):PdfBlock[] {
  const verified=report.clientSnapshotFallback?{...report,summary:report.clientSnapshotFallback.originalSummary}:report;
  const reviews=executiveReviews(verified);
  const blocks:PdfBlock[]=[
    {key:'identity',content:<ReportIdentity report={report} document/>},
  ];
  blocks.push({key:'actions-title',keepNext:true,continuationContent:<h3>Manager Action Plan (continued)</h3>,content:<h2>Manager Action Plan{report.historical?' — Historical':''}</h2>});
  const actions=[...reviews].sort((a,b)=>(a.priority==='High'?0:a.available?1:2)-(b.priority==='High'?0:b.available?1:2));
  for(const review of actions)blocks.push({key:`action-${review.id}`,continuationKey:'actions-title',content:<div className="rm-v3-pdf-action"><div><h3>{review.actionTitle}</h3><strong className={review.priority==='High'?'negative':''}>{review.priority}</strong></div><p className="rm-v2-note">Evidence: {review.evidence}</p>{review.responses.length?<ul>{review.responses.map(point=><li key={point}>{point}</li>)}</ul>:<p>No period-specific recommendation without reliable evidence.</p>}</div>});
  blocks.push(
    {key:'summary',content:<PerformanceSummary report={report}/>},
    {key:'chart-year',content:<><h2>Yearly Sales vs Target — FY {report.selectedPeriod.financialYear}</h2><PerformanceBars rows={report.yearRows} staticChart/></>},
  );
  if(report.selectedPeriod.reportType!=='yearly')blocks.push({key:'chart-context',content:<><h2>{report.reportLabel}</h2><PerformanceBars rows={report.weekRows} selectedKey={report.selectedPeriod.reportType==='weekly'?`week-${report.selectedPeriod.week}`:undefined} staticChart/><p className="rm-v2-note">{report.weekRule}</p></>});
  const attendance=report.attendance;
  const attendanceMonth=attendance?.months.find(month=>month.key===(report.attendanceMonth||defaultAttendanceMonth(attendance)));
  if(attendance)blocks.push({key:'attendance',content:<section data-report-section="attendance"><h2>{attendance.subject.role==='salesperson'?'Salesperson':'RM'} Attendance — FY {report.selectedPeriod.financialYear} {attendance.demo&&<small className="rm-demo-indicator">Demo Attendance</small>}</h2><p className="rm-v2-note">{attendance.subject.name} · {attendance.demo?'Simulated full FY, including future dates':`CRM through ${formatDate(attendance.cutoff)}`}{attendanceMonth?` · Monthly summary: ${attendanceMonthLabel(attendanceMonth.key)}`:''}</p>{attendanceMonth&&<AttendanceSummary month={attendanceMonth}/>}<RmAttendanceHeatmap data={attendance} financialYear={report.selectedPeriod.financialYear} staticView/></section>});

  blocks.push({key:'top-sales',content:<RmTopSales report={report}/>});

  const thrust=report.thrustYtd;
  if(thrust){
    const header=<><h2>Thrust Products — YTD Performance</h2><p className="rm-v2-note">{formatDate(thrust.from)}–{formatDate(thrust.to)}</p></>;
    blocks.push({key:'thrust-title',keepNext:true,content:header,continuationContent:<h3>Thrust Products (continued)</h3>});
    for(let i=0;i<thrust.products.length;i+=4)blocks.push({key:`thrust-${i}`,continuationKey:'thrust-title',content:<div className="rm-v4-thrust-grid"><ThrustProductCells products={thrust.products.slice(i,i+4)}/></div>});
    if(!thrust.products.length)blocks.push({key:'thrust-empty',content:<p className="rm-v2-note">No thrust products configured for this report.</p>});
  }
  function appendTable(table:RmPerformanceReport['tables'][number]){
    if(!table.rows.length)return;
    const grid={gridTemplateColumns:`repeat(${table.columns.length},minmax(0,1fr))`},titleKey=`table-${table.id}-title`;
    blocks.push({key:titleKey,keepNext:true,content:<><h2>{table.title}</h2>{table.note&&<p className="rm-v2-note">{table.note}</p>}<div className="rm-v3-pdf-table-head" style={grid}>{table.columns.map(column=><strong key={column}>{column}</strong>)}</div></>});
    for(const [index,row] of table.rows.entries()){
      const chunks=row.map(value=>typeof value==='string'?value.match(/[\s\S]{1,380}/g)??['']:[value]);
      for(let part=0;part<Math.max(...chunks.map(c=>c.length));part++)blocks.push({key:`table-${table.id}-${index}-${part}`,continuationKey:titleKey,content:<div className="rm-v2-pdf-table-row" style={grid}>{table.columns.map((column,i)=><div key={i}>{part&&chunks[i][part]==null?'':reportCell(chunks[i][part]??null,column)}</div>)}</div>});
    }
  }
  const invoices=report.tables.find(table=>table.id==='invoices');if(invoices)appendTable(invoices);
  const entries=report.myDayEntries??[];
  const savedGrid={gridTemplateColumns:'15fr 12fr 12fr 13fr 12fr 12fr 16fr 8fr',gap:0,padding:0};
  blocks.push({key:'saved-title',keepNext:true,content:<><h2>RM Save Entries</h2><p className="rm-v2-note">All customer activities, visit outcomes, expected orders, follow-ups and lead pipeline details in one compact view.</p>{!!entries.length&&<div className="rm-v3-pdf-table-head" style={savedGrid}>{savedEntryFields(entries[0]).map(([label],index)=><strong key={label} style={{padding:'6px 4px',textAlign:index===4?'right':'left',fontSize:9}}>{label}</strong>)}</div>}</>});
  if(!entries.length)blocks.push({key:'saved-empty',content:<p className="rm-v2-note">{report.ownershipMapping!=='verified'?'Saved inputs unavailable until this RM has a unique verified CRM profile.':'No saved entries in the selected CRM date range.'}</p>});
  for(const entry of entries){
    const fields=savedEntryFields(entry).map(([label,value],index)=>({label,chunks:(index===7?(entry.leadStage?entry.leadStage.replaceAll('_',' '):'\u2014'):index===1?value.replace('\nPriority: ','\n'):index===3?value.replace('\nTags: ','\n'):value).match(/[\s\S]{1,360}/g)??['']}));
    for(let part=0;part<Math.max(...fields.map(field=>field.chunks.length));part++){
      blocks.push({key:`saved-${entry.id}-${part}`,continuationKey:'saved-title',content:<div className="rm-v2-pdf-table-row" style={{...savedGrid,fontSize:9}}>{fields.map((field,index)=><div key={field.label} style={{minWidth:0,padding:'6px 4px',whiteSpace:'pre-wrap',overflowWrap:'anywhere',textAlign:index===4?'right':'left',fontWeight:index===0?600:undefined}}>{field.chunks[part]??''}</div>)}</div>});
    }
  }

  blocks.push({key:'insights-title',keepNext:true,continuationContent:<h3>AI Insights (continued)</h3>,content:<><h2>AI Insights</h2><p className="rm-v2-note">{report.analysisMethod==='ai-assisted'?'AI-assisted priority. AI prioritizes verified findings; figures and recommendations remain server-controlled.':'Rule-based findings. Verified metrics and deterministic findings; no LLM-generated analysis is claimed.'}{report.analysisNote?' AI review unavailable; verified fallback shown.':''}</p></>});
  for(const [index,review] of reviews.entries()){
    const fullWidthInsight=index===reviews.length-1&&reviews.length%2===1;
    const insight=<article key={review.id}><h3>{review.title}</h3><span>{!review.available?'Unavailable':review.priority==='High'?'Attention':'Review'}</span><ul>{review.points.map(point=><li key={point}>{point}</li>)}</ul></article>;
    blocks.push({key:`insight-${review.id}`,continuationKey:'insights-title',insight,fullWidthInsight,content:<div className="rm-v3-pdf-insights" style={fullWidthInsight?{gridTemplateColumns:'minmax(0,1fr)'}:undefined}>{insight}</div>});
  }

  return blocks;
}

export function RmPerformancePdfDocument({report}:{report:RmPerformanceReport}) {
  const blocks=useMemo(()=>reportBlocks(report),[report]);
  const measure=useRef<HTMLDivElement>(null);
  const [pages,setPages]=useState<PdfBlock[][]>([]);
  const [error,setError]=useState('');
  useLayoutEffect(()=>{
    let cancelled=false;
    setPages([]);setError('');
    const paginate=()=>{
      if(cancelled||!measure.current)return;
      const header = measure.current.querySelector('header')!;
      const footer = measure.current.querySelector('footer')!;
      const pageTop=measure.current.getBoundingClientRect().top;
      const contentTop=header.getBoundingClientRect().bottom-pageTop+parseFloat(getComputedStyle(header).marginBottom);
      const contentHeight=PAGE_HEIGHT-contentTop-parseFloat(getComputedStyle(footer).bottom)-footer.getBoundingClientRect().height-12;
      const elements=Array.from(measure.current.querySelectorAll<HTMLElement>(':scope > [data-pdf-block]'));
      const continuationHeights=new Map(Array.from(measure.current.querySelectorAll<HTMLElement>(':scope > [data-pdf-continuation]')).map(el=>[el.dataset.pdfContinuation!,el.getBoundingClientRect().height]));
      const measured=blocks.map((block,index)=>({key:block.key,height:elements[index].getBoundingClientRect().height,keepNext:block.keepNext,continuationKey:block.continuationKey,pairWithNext:!!block.insight&&!block.fullWidthInsight,continuationHeight:continuationHeights.get(block.key)}));
      try{
        const layout=paginatePdfBlocks(measured,contentHeight),byKey=new Map(blocks.map(block=>[block.key,block]));
        const result=layout.map(page=>page.map(item=>{
          const first=byKey.get(item.keys[0])!;
          if(item.continuation)return {...first,key:`continued-${first.key}`,content:first.continuationContent??first.content};
          if(item.keys.length===2)return {key:item.keys.join('-'),content:<div className="rm-v3-pdf-insights">{item.keys.map(key=>byKey.get(key)!.insight)}</div>};
          return first;
        }));
        setPages(result);
      }catch{
        setError('A complete report card or heading with its content exceeds one page. Please review its content before export.');
      }
    };
    void document.fonts.ready.then(()=>{if(!cancelled)paginate();});
    return ()=>{cancelled=true;};
  },[blocks]);
  return <div className="rm-v2-pdf" id="rm-report-render-target" data-pagination-ready={pages.length>0?'true':'false'}>
    <div ref={measure} className="rm-v2-pdf-page rm-v2-pdf-measure" style={{width:794,height:'auto'}} aria-hidden="true"><PageHeader report={report}/>{blocks.map(b=><div className="rm-v2-pdf-block" data-pdf-block={b.key} key={b.key}>{b.content}</div>)}{blocks.filter(b=>b.continuationContent).map(b=><div className="rm-v2-pdf-block" data-pdf-continuation={b.key} key={`continuation-${b.key}`}>{b.continuationContent}</div>)}<PageFooter report={report} page={1} count={1}/></div>
    {error&&<p role="alert">{error}</p>}
    {!pages.length&&!error&&<p style={{color:'white'}}>Preparing report pages…</p>}
    {pages.map((page,index)=><div key={index} className="rm-v2-pdf-page" data-rm-report-page>
      <PageHeader report={report}/>
      <div className="rm-v2-pdf-page-content">{page.map(b=><div className="rm-v2-pdf-block" data-pdf-block={b.key} key={b.key}>{b.content}</div>)}</div>
      <PageFooter report={report} page={index+1} count={pages.length}/>
    </div>)}
  </div>;
}

export function RmPerformancePdfPreview({report,onClose,onDownload}:{report:RmPerformanceReport;onClose:()=>void;onDownload:()=>Promise<boolean>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    dialog.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busy)onClose();
      if(event.key==='Tab'){
        const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if(!buttons?.length)return;
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',onKey);
    return ()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
  },[onClose,busy]);
  async function download(){
    setBusy(true);setError('');
    try{if(!await onDownload())setError('The PDF is not ready or could not be generated. Please retry.');}
    catch{setError('PDF generation failed. Please retry.');}
    finally{setBusy(false);}
  }
  return <div className="rm-v2-preview" role="dialog" aria-modal="true" aria-label="RM report PDF preview" tabIndex={-1} ref={dialog}>
    <div className="rm-v2-preview-toolbar"><strong>{report.name} · {report.reportLabel}</strong><div><button type="button" disabled={busy} onClick={download}>{busy?'Generating PDF…':'Download PDF'}</button> <button type="button" disabled={busy} onClick={onClose}>Close</button></div></div>
    {error&&<div role="alert" className="rm-v2-preview-error">{error}</div>}
    <div className="rm-v2-preview-scroll"><RmPerformancePdfDocument report={report}/></div>
  </div>;
}
