"use client";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { AttendanceDay, AttendanceReport } from '../../../shared/rm-attendance.mjs';
import { indiaBusinessDate } from '@/lib/business-date';
import styles from './rm-attendance-heatmap.module.css';

type CalendarDay = { date:string; weekday:number; row:number; column:number; record?:AttendanceDay };
type ActiveDay = { day:CalendarDay; anchor:DOMRect; mode:'hover'|'focus'|'touch' };
const COLORS={present:'#16A34A',absent:'#DC2626',holiday:'#9CA3AF',neutral:'#F1F5F9'};
const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const fullDate=(date:string)=>new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',year:'numeric'});

function status(day:CalendarDay,available:boolean) {
  if(day.weekday===0||day.record?.holiday)return {state:'holiday' as const,label:day.weekday===0?'Weekly Holiday':'Holiday'};
  if(available&&day.record?.status==='present')return {state:'present' as const,label:'Present'};
  if(available&&day.record?.status==='absent')return {state:'absent' as const,label:'Absent'};
  return {state:'neutral' as const,label:day.record?.status==='upcoming'?'Upcoming / beyond cutoff':'Unverified / unavailable'};
}
function clock(value:string|null,date:string) {
  if(!value)return 'Not recorded';
  const normalized=/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?value:`${value.replace(' ','T')}Z`;
  const instant=new Date(normalized);
  if(!Number.isFinite(instant.getTime()))return 'Unverified timestamp';
  const time=instant.toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).replace(/\b(am|pm)\b/g,part=>part.toUpperCase());
  return indiaBusinessDate(instant)===date?time:`${time} (${instant.toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'})})`;
}

/** Calendar placement only. Status/session aggregation stays in the existing API. */
export function RmAttendanceHeatmap({data,financialYear,footer,staticView=false}:{data:AttendanceReport;financialYear:string;footer?:ReactNode;staticView?:boolean}) {
  const tooltipId=useId(),tooltip=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null);
  const pointerType=useRef('mouse');
  const [active,setActive]=useState<ActiveDay|null>(null),[placement,setPlacement]=useState<{left:number;top:number}|null>(null),[overflow,setOverflow]=useState(false);
  const months=useMemo(()=>{
    const records=new Map<string,AttendanceDay>();
    for(const month of data.months)for(const day of month.days)if(!records.has(day.date))records.set(day.date,day);
    const year=Number(financialYear.slice(0,4));
    return Array.from({length:12},(_,index)=>{
      const start=new Date(Date.UTC(year,index+3,1)),monthYear=start.getUTCFullYear(),monthNumber=start.getUTCMonth()+1;
      const key=`${monthYear}-${String(monthNumber).padStart(2,'0')}`,firstRow=(start.getUTCDay()+6)%7;
      const length=new Date(Date.UTC(monthYear,monthNumber,0)).getUTCDate();
      return {key,label:start.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}),columns:Math.max(5,Math.ceil((firstRow+length)/7)),days:Array.from({length},(_,i)=>{
        const date=`${key}-${String(i+1).padStart(2,'0')}`,weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
        return {date,weekday,row:(weekday+6)%7+1,column:Math.floor((firstRow+i)/7)+1,record:records.get(date)};
      })};
    });
  },[data,financialYear]);
  useEffect(()=>{setActive(null);setPlacement(null);},[financialYear,data.subject.name]);
  useEffect(()=>{
    setActive(previous=>{
      if(!previous)return null;
      const day=months.flatMap(month=>month.days).find(day=>day.date===previous.day.date);
      return day?{...previous,day}:null;
    });
  },[months]);
  useEffect(()=>{
    if(!viewport.current)return;
    const el=viewport.current,observe=()=>setOverflow(el.scrollWidth>el.clientWidth+1);
    observe();const observer=new ResizeObserver(observe);observer.observe(el);return()=>observer.disconnect();
  },[months]);
  useEffect(()=>{
    const close=()=>setActive(null);
    const scroll=()=>setActive(previous=>{
      if(!previous||previous.mode==='touch')return null;
      const element=viewport.current?.querySelector<HTMLButtonElement>(`[data-attendance-date="${previous.day.date}"]`);
      const anchor=element?.getBoundingClientRect();
      if(!anchor||anchor.bottom<0||anchor.top>window.innerHeight||anchor.right<0||anchor.left>window.innerWidth)return null;
      return {...previous,anchor};
    });
    const outside=(event:PointerEvent)=>{if(!(event.target instanceof Element)||!event.target.closest('[data-attendance-date]'))setActive(previous=>previous?.mode==='touch'?null:previous);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};
    window.addEventListener('resize',close);window.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
  },[]);
  useLayoutEffect(()=>{
    if(!active||!tooltip.current)return;
    const size=tooltip.current.getBoundingClientRect(),edge=8;
    const left=Math.max(edge,Math.min(active.anchor.left+active.anchor.width/2-size.width/2,document.documentElement.clientWidth-size.width-edge));
    const above=active.anchor.top-size.height-edge;
    const top=Math.max(edge,Math.min(above>=edge?above:active.anchor.bottom+edge,window.innerHeight-size.height-edge));
    setPlacement({left,top});
  },[active]);
  const show=(day:CalendarDay,element:HTMLButtonElement,mode:ActiveDay['mode'])=>{setPlacement(null);setActive({day,anchor:element.getBoundingClientRect(),mode});};
  const activeStatus=active?status(active.day,data.available):null;
  const groups=staticView?[months.slice(0,6),months.slice(6)]:[months];
  return <div className={`${styles.heatmap} ${staticView?styles.static:''}`} data-attendance-demo={data.demo?'true':'false'}>
    <div className={styles.viewport} ref={viewport} role="region" aria-label="Full financial year attendance calendar" tabIndex={staticView?undefined:0}>
      {groups.map((group,index)=><div className={styles.canvas} key={index}>
        <div className={styles.weekdays} aria-hidden="true"><div className={styles.monthSpacer}/><div className={styles.weekdayRows}>{WEEKDAYS.map((label,index)=><span key={index}>{label}</span>)}</div></div>
        {group.map(month=><div key={month.key} className={styles.month} data-attendance-month={month.key} role="group" aria-label={`${month.label} ${month.key.slice(0,4)} attendance`}>
          <div className={styles.monthLabel}>{month.label}</div>
          <div className={styles.days} style={{gridTemplateColumns:`repeat(${month.columns},var(--attendance-square))`}}>{month.days.map(day=>{
            const current=status(day,data.available),selected=active?.day.date===day.date;
            if(staticView)return <span key={day.date} className={styles.cell} data-attendance-date={day.date} data-attendance-state={current.state} data-simulated-date={data.demo?'true':undefined} data-simulated-future={data.demo&&day.date>data.demo.realToday?'true':undefined} style={{gridRow:day.row,gridColumn:day.column,backgroundColor:COLORS[current.state]}} aria-label={`${fullDate(day.date)}. ${current.label}${data.demo?'. Demo Attendance; simulated':''}`}/>;
            return <button key={day.date} type="button" className={styles.cell} data-attendance-date={day.date} data-attendance-state={current.state}
              data-simulated-date={data.demo?'true':undefined}
              data-simulated-future={data.demo&&day.date>data.demo.realToday?'true':undefined}
              style={{gridRow:day.row,gridColumn:day.column,backgroundColor:COLORS[current.state]} as CSSProperties}
              aria-label={`${fullDate(day.date)}. ${current.label}${day.record?.workedHoliday?'. Worked on holiday':''}${data.demo?`. Demo Attendance; ${day.date>data.demo.realToday?'future simulated date':'simulated date'}`:''}`}
              aria-describedby={selected?tooltipId:undefined}
              onPointerDown={event=>{pointerType.current=event.pointerType;}}
              onPointerEnter={event=>{if(event.pointerType!=='touch')show(day,event.currentTarget,'hover');}}
              onPointerLeave={()=>setActive(previous=>previous?.day.date===day.date&&previous.mode!=='touch'?null:previous)}
              onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))show(day,event.currentTarget,'focus');}}
              onBlur={()=>setActive(previous=>previous?.day.date===day.date?null:previous)}
              onKeyDown={()=>{pointerType.current='keyboard';}}
              onClick={event=>{if(pointerType.current==='touch'){if(active?.mode==='touch'&&selected)setActive(null);else show(day,event.currentTarget,'touch');}}}
            />;
          })}{Array.from({length:month.columns*7},(_,index)=>{
            const firstRow=month.days[0].row-1;
            if(index>=firstRow&&index<firstRow+month.days.length)return null;
            return <span key={`placeholder-${index}`} className={styles.cell} aria-hidden="true" style={{gridRow:index%7+1,gridColumn:Math.floor(index/7)+1,backgroundColor:'#E5E7EB',pointerEvents:'none',cursor:'default'}}/>;
          })}</div>
        </div>)}
      </div>)}
    </div>
    <div className={styles.footer}><div className={styles.legend}>{[['present','Present'],['absent','Absent'],['holiday','Sunday / Holiday']].map(([state,label])=><span key={state}><i aria-hidden="true" style={{backgroundColor:COLORS[state as keyof typeof COLORS]}}/>{label}</span>)}</div><div className={styles.actions}>{footer}</div></div>
    {overflow&&!staticView&&<small className={styles.scrollHint}>Scroll horizontally to view all months. Focus the calendar to scroll with the keyboard.</small>}
    {active&&!staticView&&createPortal(<div id={tooltipId} ref={tooltip} role="tooltip" className={styles.tooltip} style={{left:placement?.left??0,top:placement?.top??0,visibility:placement?'visible':'hidden'}}>
      <strong>{fullDate(active.day.date)}</strong><p>Status: {activeStatus?.label}</p>
      {data.demo&&<small>Demo Attendance · {active.day.date>data.demo.realToday?'Future date · simulated':'Simulated date'}</small>}
      {(active.day.weekday===0||active.day.record?.holiday)&&active.day.record?.status==='present'&&<p>Worked on holiday</p>}
      {active.day.record?.sessions.length?active.day.record.sessions.map((session,index)=><div className={styles.session} key={index}>{active.day.record!.sessions.length>1&&<small>Session {index+1}</small>}<dl><dt>Clock In</dt><dd>{clock(session.checkInAt,active.day.date)}</dd><dt>Clock Out</dt><dd>{session.invalidClockOut?'Unverified timestamp / interval':clock(session.checkOutAt,active.day.date)}</dd></dl></div>):<dl><dt>Clock In</dt><dd>—</dd><dt>Clock Out</dt><dd>—</dd></dl>}
      {!!active.day.record?.incompleteCount&&<small>Incomplete clock-out</small>}
    </div>,document.body)}
  </div>;
}
