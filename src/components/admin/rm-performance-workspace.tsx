"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { adminApi, rmApi, authApi } from '@/lib/api';
import { useAdminData } from '@/lib/use-admin-data';
import { indiaBusinessDate } from '@/lib/business-date';
import { rmReportPeriod, type RmReportSelection } from '../../../shared/rm-report-period.mjs';
import type { RmPerformanceReport } from '../../../shared/rm-performance.mjs';
import { RmPerformanceChart } from '../reports/rm-performance-chart';
import { ReportIdentity, PerformanceSummary, PerformanceDetails, PerformanceInsights, PerformanceActions } from '../reports/rm-performance-view';
import { RmAttendance, defaultAttendanceMonth } from '../reports/rm-attendance';
import { raisKhanClientSnapshot } from '@/lib/rais-khan-client-snapshot.mjs';
import { canUseLocalReportPreview, localReportPreview } from '@/lib/rm-client-demo.mjs';
import { RmMyDayInputs } from '../reports/rm-my-day-inputs';
import { RefreshDataButton } from '../common/refresh-data-button';
import { RmReportPreviewModal } from './rm-report-pdf';
import '../reports/rm-performance.css';

const initialYear=()=>{
  const date=indiaBusinessDate(),year=Number(date.slice(0,4))-(Number(date.slice(5,7))<4?1:0);
  return `${year}-${String(year+1).slice(-2)}`;
};
const yearOptions=()=>{
  const start=Number(initialYear().slice(0,4));
  return Array.from({length:5},(_,index)=>{const year=start+1-index;return `${year}-${String(year+1).slice(-2)}`;});
};

export function ReportCardTab({ report, yearReport, selection, onSelection, loading, attendanceMonth, onAttendanceMonth, presentationReport, presentationYear }: {
  report: RmPerformanceReport | null;yearReport:RmPerformanceReport;selection:RmReportSelection;onSelection:(s:RmReportSelection)=>void;loading:boolean;
  attendanceMonth:string;onAttendanceMonth:(month:string)=>void;
  presentationReport:RmPerformanceReport|null;presentationYear:RmPerformanceReport;
}) {
  const month=selection.reportType==='yearly'?undefined:Number(selection.month);
  const week=selection.reportType==='weekly'?Number(selection.week):undefined;
  const previous = useRef(report ?? yearReport);
  if (report) previous.current = report;
  const verified = report ?? previous.current;
  const previousPresentation=useRef(presentationReport??presentationYear);
  if(presentationReport)previousPresentation.current=presentationReport;
  const displayed=presentationReport??previousPresentation.current;
  const chartYear=presentationYear,chartActive=presentationReport;
  const select=(reportType:RmReportSelection['reportType'],nextMonth?:number,nextWeek?:number)=>onSelection({financialYear:selection.financialYear,reportType,month:nextMonth,week:nextWeek,weekScheme:'four'});
  return <>
    <div className={`rm-v3-period-content ${!report?'pending':''}`} aria-busy={!report}><div aria-hidden={!report}><PerformanceActions report={verified}/></div></div>
    <div className={`rm-v3-period-content ${!report?'pending':''}`} aria-busy={!report}><div aria-hidden={!report}><PerformanceSummary report={displayed}/></div>{!report&&<p className="rm-v3-update-status" role="status">Updating selected reporting context…</p>}</div>
    <nav className="rm-v2-context-nav" aria-label="Reporting context"><span>Reporting context</span><button type="button" onClick={()=>select('yearly')}>FY {selection.financialYear}</button>{month&&<><span>/</span><button type="button" onClick={()=>select('monthly',month)}>{yearReport.yearRows.find(r=>r.month===month)?.label}</button></>}{week&&<><span>/</span><strong>Week {week}</strong></>}</nav>
    <RmPerformanceChart yearReport={chartYear} activeReport={chartActive} month={month} week={week} loading={loading} onMonth={m=>select('monthly',m)} onWeek={w=>select('weekly',month,w)} onReset={()=>select('yearly')} onBackMonth={()=>select('monthly',month)}/>
    <RmAttendance data={displayed.attendance} monthKey={attendanceMonth} onMonthChange={onAttendanceMonth} selection={selection}/>
    <div className={`rm-v3-period-content ${!report?'pending':''}`} aria-busy={!report}><div aria-hidden={!report}>
      <PerformanceDetails report={displayed}/>
      <RmMyDayInputs key={`${displayed.id}-${displayed.from}-${displayed.to}`} report={displayed}/>
      <PerformanceInsights report={verified}/>
    </div></div>
  </>;
}

export function RmPerformanceWorkspace({rmId:initialRmId,audience='admin'}:{rmId:string;audience?:'admin'|'rm'}) {
  const [rmId,setRmId]=useState(initialRmId);
  const [salespersonId,setSalespersonId]=useState('');
  const availableYears=yearOptions();
  const [selection,setSelection]=useState<RmReportSelection>(()=>({reportType:'yearly',financialYear:initialYear(),weekScheme:'four'}));
  const [preview,setPreview]=useState(false);
  const [previewRole,setPreviewRole]=useState<string|null>(null),[previewHost,setPreviewHost]=useState(''),[demoScope,setDemoScope]=useState<string|null>(null);
  const demoKey=`${rmId}|${selection.financialYear}|${salespersonId}`;
  const demoAllowed=canUseLocalReportPreview({role:previewRole,audience,hostname:previewHost})&&!salespersonId;
  const demoEnabled=demoAllowed&&demoScope===demoKey;
  useEffect(()=>{
    let active=true;
    if(audience==='admin'&&['localhost','127.0.0.1','::1','[::1]'].includes(window.location.hostname))void authApi.me().then(({user})=>{if(active){setPreviewRole(user.role);setPreviewHost(window.location.hostname);}}).catch(()=>{});
    const clear=()=>{setPreviewRole(null);setDemoScope(null);};window.addEventListener('psspl:session-cleared',clear);
    return()=>{active=false;window.removeEventListener('psspl:session-cleared',clear);};
  },[audience]);
  useEffect(()=>{setDemoScope(null);},[demoKey]);
  const [attendanceMonth,setAttendanceMonth]=useState('');
  useEffect(()=>{setAttendanceMonth('');},[rmId,salespersonId,selection.financialYear]);
  useEffect(()=>{if(selection.reportType!=='yearly'&&selection.month){const year=Number(selection.financialYear.slice(0,4))+(Number(selection.month)<4?1:0);setAttendanceMonth(`${year}-${String(selection.month).padStart(2,'0')}`);}},[selection.financialYear,selection.reportType,selection.month]);
  useEffect(()=>{setRmId(initialRmId);setSalespersonId('');setPreview(false);},[initialRmId]);
  const yearSelection:RmReportSelection={reportType:'yearly',financialYear:selection.financialYear,weekScheme:'four'};
  const load=(s:RmReportSelection)=>audience==='rm'?rmApi.performanceReport(s,salespersonId):adminApi.rmPerformanceReport(rmId,s,salespersonId);
  const scopeKey=salespersonId?`person-${encodeURIComponent(salespersonId)}`:'full-team';
  const yearKey=`rm-v2-${audience}-${rmId}-${scopeKey}-${selection.financialYear}-yearly`;
  const annual=useAdminData(()=>load(yearSelection),[rmId,salespersonId,selection.financialYear,audience],yearKey);
  const {from,to}=rmReportPeriod(selection);
  const active=useAdminData(()=>load(selection),[rmId,salespersonId,from,to,selection.financialYear,selection.reportType,audience],selection.reportType==='yearly'?yearKey:`rm-v2-${audience}-${rmId}-${scopeKey}-${selection.financialYear}-${from}-${to}-${selection.reportType}`);
  const matchesScope=(data:RmPerformanceReport|null)=>!!data&&(data.selectedSalespersonId??'')===salespersonId&&(audience==='rm'||data.id===rmId);
  const yearReport=annual.data?.selectedPeriod.financialYear===selection.financialYear&&matchesScope(annual.data)?annual.data:null;
  const report=active.data?.from===from&&active.data.to===to&&active.data.selectedPeriod.reportType===selection.reportType&&matchesScope(active.data)?active.data:null;
  const selectedAttendanceMonth=attendanceMonth||defaultAttendanceMonth(yearReport?.attendance);
  const demoToday=indiaBusinessDate();
  const presentationYear=useMemo(()=>yearReport?raisKhanClientSnapshot(yearReport):null,[yearReport]);
  const exportReport=useMemo(()=>report?localReportPreview({...raisKhanClientSnapshot(report),attendance:yearReport?.attendance??report.attendance,attendanceMonth:selectedAttendanceMonth},{enabled:demoEnabled,role:previewRole,audience,hostname:previewHost,today:demoToday}):null,[report,yearReport?.attendance,selectedAttendanceMonth,demoEnabled,previewRole,audience,previewHost,demoToday]);
  const identityReport=exportReport??presentationYear;
  const salespeople=(audience==='rm'||annual.data?.id===rmId)?annual.data?.salespeople??[]:[];
  const refreshRef=useRef(()=>{});
  refreshRef.current=()=>{
    if(preview||demoEnabled||document.visibilityState!=='visible')return;
    annual.reload();
    active.reload();
  };
  useEffect(()=>{
    const refresh=()=>refreshRef.current();
    const interval=window.setInterval(refresh,15000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const change=(s:RmReportSelection)=>{setSelection(s);setPreview(false);};
  const error=active.error||annual.error;
  const years=[...new Set([...availableYears,...(yearReport?.financialYears??[]),selection.financialYear])].sort().reverse();
  const controls = <div className="rm-v2-toolbar">
      <div className="rm-v3-toolbar-selects"><label>Financial Year <select aria-label="Financial Year" value={selection.financialYear} onChange={e=>change({reportType:'yearly',financialYear:e.target.value,weekScheme:'four'})}>{years.map(year=><option key={year} value={year}>FY {year}</option>)}</select></label>
      <label>Salesperson <select aria-label="Salesperson" value={salespersonId} disabled={!salespeople.length} onChange={e=>{setSalespersonId(e.target.value);change({...selection,reportType:'yearly',month:undefined,week:undefined});}}><option value="">{salespeople.length?'RM & full team':'No salespeople assigned'}</option>{salespeople.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>
      <div className="rm-v3-toolbar-actions">{demoAllowed&&<button type="button" className="rm-demo-toggle" aria-pressed={demoEnabled} disabled={!report||!!error} onClick={()=>{setDemoScope(demoEnabled?null:demoKey);setPreview(false);}}>{demoEnabled?'Exit Preview':'Start Preview'}</button>}<RefreshDataButton inline/><button className="rm-v2-download" type="button" disabled={!report||active.loading||annual.loading||!!error} onClick={()=>setPreview(true)}>Download PDF</button></div>
      <small>{report?`${report.reportLabel} · Data as of ${report.asOf.split('-').reverse().join('-')}`:'Updating report context…'}</small>
    </div>;
  return <main className="rm-v2 rm-v3">
    {audience==='admin'&&<Link href="/admin/team">← Back to Team performance</Link>}
    {identityReport?<ReportIdentity report={identityReport} controls={controls}/>:controls}
    {error&&<div role="alert">{error} <button type="button" onClick={()=>{annual.reload();active.reload();}}>Retry</button></div>}
    {yearReport&&presentationYear?<ReportCardTab key={`${rmId}-${salespersonId}-${selection.financialYear}`} report={report} yearReport={yearReport} selection={selection} onSelection={change} loading={!report} attendanceMonth={selectedAttendanceMonth} onAttendanceMonth={setAttendanceMonth} presentationReport={exportReport} presentationYear={presentationYear}/>:!error&&<div className="rm-v2-loading" role="status">Loading financial-year report…</div>}
    {exportReport&&<RmReportPreviewModal isOpen={preview} onClose={()=>setPreview(false)} data={exportReport} period={selection.reportType==='yearly'?'fytd':selection.reportType==='weekly'?'week':'month'}/>}
  </main>;
}
