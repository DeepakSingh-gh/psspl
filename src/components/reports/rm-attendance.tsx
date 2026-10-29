"use client";
import { useEffect, useRef, useState } from 'react';
import type { AttendanceDay, AttendanceMonth, AttendanceReport } from '../../../shared/rm-attendance.mjs';
import type { RmReportSelection } from '../../../shared/rm-report-period.mjs';
import { formatDate } from '@/lib/format';
import { RmAttendanceHeatmap } from './rm-attendance-heatmap';

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const statusLabel = (day: AttendanceDay) => day.workedHoliday ? 'Worked on holiday' : day.status === 'present' && day.incompleteCount ? 'Present · incomplete clock-out' : ({present:'Present',absent:'Absent',holiday:'Holiday',upcoming:'Upcoming / beyond cutoff',unverified:'Unverified check-in'})[day.status];
export const attendanceMonthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'Asia/Kolkata'});
export const attendanceDuration = (minutes: number | null) => minutes == null ? 'N/A' : `${Math.floor(Math.round(minutes)/60)}h ${Math.round(minutes)%60}m`;
export function defaultAttendanceMonth(data?: AttendanceReport) {
  if(!data)return '';
  const latest=[...data.months].reverse();
  return latest.find(m=>m.from<=data.cutoff&&m.days.some(day=>day.sessions.length>0))?.key??latest.find(m=>m.from<=data.cutoff)?.key??data.months[0]?.key??'';
}
const timestamp = (value: string | null) => {
  if(!value)return '—';
  const normalized=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?value:`${value.replace(' ','T')}Z`;
  const date=new Date(normalized);
  return Number.isFinite(date.getTime())?date.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}).replace(/\b(am|pm)\b/g,part=>part.toUpperCase()):'Unverified timestamp';
};

export function AttendanceSummary({month, detailed=false,highlightValues=false}:{month:AttendanceMonth;detailed?:boolean;highlightValues?:boolean}) {
  const s=month.summary;
  const metrics:Array<[string,string|number]>=[['Present',s.present??'N/A'],['Absent',s.absent??'N/A'],['Holidays',s.holidays],['Attendance',s.attendancePercent==null?'N/A':`${s.attendancePercent.toFixed(2)}%`]];
  if(detailed)metrics.push(['Eligible working days',s.eligibleWorkingDays??'N/A'],['Recorded hours',attendanceDuration(s.workedMinutes)],['Incomplete clock-out',s.incompleteCount??'N/A']);
  return <dl className="rm-v4-attendance-summary">{metrics.map(([name,value])=><div key={name}><dt>{name}</dt><dd style={highlightValues&&typeof value==='number'?{color:name==='Present'?'#16A34A':name==='Absent'?'#DC2626':undefined}:highlightValues&&name==='Attendance'&&value!=='N/A'?{color:'#0284C7'}:undefined}>{value}</dd></div>)}</dl>;
}

export function RmAttendance({data,monthKey,onMonthChange,selection}:{data?:AttendanceReport;monthKey:string;onMonthChange:(key:string)=>void;selection:RmReportSelection}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false),[descending,setDescending]=useState(false),[selectedDate,setSelectedDate]=useState('');
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  useEffect(()=>{setOpen(false);setSelectedDate('');},[monthKey,data?.subject.name]);
  if(!data)return <section className="rm-v2-section rm-v4-attendance"><h2>RM Attendance</h2><p className="rm-v2-note">Attendance source unavailable.</p></section>;
  const month=data.months.find(m=>m.key===monthKey)??data.months[0];
  if(!month)return null;
  const index=data.months.indexOf(month);
  const title=data.subject.role==='salesperson'?'Salesperson Attendance':'RM Attendance';
  const detailRows=descending?[...month.days].reverse():month.days;
  const show=(date='')=>{setSelectedDate(date);setOpen(true);};
  return <section className="rm-v2-section rm-v4-attendance" aria-label={title} data-report-section="attendance">
    <div className="rm-v4-attendance-heading"><div><h2>{title} <span>— FY {selection.financialYear}</span> {data.demo&&<small className="rm-demo-indicator">Demo Attendance</small>}</h2><small>{data.subject.name} · {data.demo?'Simulated full FY':`CRM through ${formatDate(data.cutoff)}`}</small></div><div className="rm-v4-month-nav" aria-label="Summary and detailed attendance month"><small>Month details</small><button type="button" aria-label="Previous attendance month" disabled={index===0} onClick={()=>onMonthChange(data.months[index-1].key)}>‹</button><span>{attendanceMonthLabel(month.key)}</span><button type="button" aria-label="Next attendance month" disabled={index===data.months.length-1} onClick={()=>onMonthChange(data.months[index+1].key)}>›</button></div></div>
    <div role="group" aria-label={`Attendance summary for ${attendanceMonthLabel(month.key)}`}><AttendanceSummary month={month} highlightValues/></div>
    <RmAttendanceHeatmap data={data} financialYear={selection.financialYear} footer={<>{(month.summary.incompleteCount??0)>0&&<span>{month.summary.incompleteCount} incomplete clock-out</span>}<button type="button" onClick={()=>show()}>View Detailed Attendance</button></>}/>
    {!data.demo&&data.note&&<p className="rm-v2-note">{data.note}</p>}
    <dialog ref={dialog} className="rm-v4-attendance-dialog" aria-labelledby="attendance-detail-title" onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <header><div><h2 id="attendance-detail-title">{data.subject.name} · Attendance {data.demo&&<small className="rm-demo-indicator">Demo Attendance</small>}</h2><p>Code {data.subject.code??'unavailable'} · {attendanceMonthLabel(month.key)}</p><small>{formatDate(month.from)}–{formatDate(month.to)} · {data.demo?'Simulated full FY':`CRM cutoff ${formatDate(data.cutoff)}`} · Asia/Kolkata</small></div><button type="button" aria-label="Close attendance details" onClick={()=>setOpen(false)}>Close ×</button></header>
      <div className="rm-v4-attendance-sheet"><AttendanceSummary month={month} detailed/><p className="rm-v2-note">{data.note} Recorded hours include valid completed intervals only; overlapping intervals are counted once.</p>
        <table><thead><tr><th><button type="button" onClick={()=>setDescending(!descending)} aria-label="Sort attendance by date">Date {descending?'↓':'↑'}</button></th><th>Day</th><th>Status</th><th>Clock In</th><th>Clock Out</th><th>Worked Hours</th></tr></thead><tbody>{detailRows.map(day=><tr key={day.date} className={selectedDate===day.date?'highlighted':''}><th scope="row">{formatDate(day.date)}</th><td>{dayNames[day.weekday].slice(0,3)}</td><td><span className={`rm-v4-attendance-badge ${day.status}`}>{statusLabel(day)}</span></td><td>{day.sessions.length?day.sessions.map((s,i)=><div key={i}>{timestamp(s.checkInAt)}{day.sessions.length>1&&<small> Session {i+1}</small>}</div>):'—'}</td><td>{day.sessions.length?day.sessions.map((s,i)=><div key={i}>{s.invalidClockOut?'Unverified clock-out timestamp or interval':s.incomplete?(s.checkoutAfterCutoff?'Incomplete at reporting cutoff':'Incomplete — clock-out not recorded'):timestamp(s.checkOutAt)}</div>):'—'}</td><td>{attendanceDuration(day.workedMinutes)}</td></tr>)}</tbody></table>
      </div>
    </dialog>
  </section>;
}
