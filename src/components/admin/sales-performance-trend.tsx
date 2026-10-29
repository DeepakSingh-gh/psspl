"use client";
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {indiaBusinessDate} from '@/lib/business-date';
import {salesAxis,salesComparison,salesLine,salesMoney,salesTrendPoints,type SalesTrendRow} from '@/lib/sales-trend.mjs';
import styles from './sales-performance-trend.module.css';

export function SalesTrend({rows,grain,financialYear,periodEnd,pending=false,unavailableReason}:{rows:SalesTrendRow[];grain:'month'|'quarter';financialYear:string;periodEnd:string;pending?:boolean;unavailableReason?:string}) {
  const today=indiaBusinessDate(),id=useId(),container=useRef<HTMLDivElement>(null),tooltip=useRef<HTMLDivElement>(null),pointerType=useRef('mouse');
  const [width,setWidth]=useState(760),[active,setActive]=useState<{key:string;anchor:DOMRect}|null>(null),[placement,setPlacement]=useState<{left:number;top:number}|null>(null);
  const points=useMemo(()=>salesTrendPoints(rows,{financialYear,periodEnd,today,grain}),[rows,financialYear,periodEnd,today,grain]);
  const previousYear=`${Number(financialYear.slice(0,4))-1}-${financialYear.slice(2,4)}`;
  const axis=salesAxis(points),height=290,left=65,right=16,top=22,bottom=35;
  const x=(i:number)=>left+i*(width-left-right)/Math.max(1,points.length-1);
  const y=(value:number)=>top+(axis.max-value)/(axis.max-axis.min)*(height-top-bottom);
  const shown=points.find(point=>point.key===active?.key),comparison=shown?salesComparison(shown.current,shown.previous):null;
  const hasData=points.some(point=>point.current!=null||point.previous!=null);
  useEffect(()=>{const node=container.current;if(!node)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(280,Math.round(entry.contentRect.width))));observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{setActive(null);setPlacement(null);},[rows,financialYear,grain,pending]);
  useEffect(()=>{const close=()=>setActive(null);window.addEventListener('scroll',close,true);window.addEventListener('resize',close);return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};},[]);
  useLayoutEffect(()=>{if(!active||!tooltip.current)return;const size=tooltip.current.getBoundingClientRect(),edge=8;setPlacement({left:Math.max(edge,Math.min(active.anchor.left+active.anchor.width/2-size.width/2,document.documentElement.clientWidth-size.width-edge)),top:Math.max(edge,Math.min(active.anchor.top-size.height-edge>=edge?active.anchor.top-size.height-edge:active.anchor.bottom+edge,window.innerHeight-size.height-edge))});},[active]);
  const show=(key:string,node:SVGGElement)=>{setPlacement(null);setActive({key,anchor:node.getBoundingClientRect()});};
  const shownMoney=(value:number|null)=>value==null?'Data Not Available':salesMoney(value);
  const signed=(value:number|null)=>value==null?'Data Not Available':`${value>0?'+':''}${salesMoney(value)}`;
  return <div className={styles.chart} ref={container} aria-busy={pending}>
    <div className={styles.plot} onMouseLeave={()=>{if(pointerType.current!=='touch')setActive(null);}}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Sales Performance Trend">
        <title>Current and previous financial year net sales in rupees; gaps are unavailable values.</title>
        {hasData&&axis.ticks.map(value=><g key={value}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} className={styles.grid} strokeDasharray="4 5"/><text x={left-10} y={y(value)+4} textAnchor="end" className={styles.axis}>{salesMoney(value,Math.abs(value)>=1000?1:0)}</text></g>)}
        {(['previous','current'] as const).map(field=><g key={field} data-sales-series={field}>
          <path d={pending?'':salesLine(points,field,x,y)} fill="none" stroke={field==='current'?'#2769BE':'#308840'} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
          {!pending&&points.map((point,index)=>point[field]==null?null:<circle key={point.key} cx={x(index)} cy={y(point[field]!)} r="5" fill={field==='current'?'#2769BE':'#308840'} data-sales-value={point[field]} data-sales-period={point.key}/>)}
        </g>)}
        {!pending&&points.map((point,index)=><g key={point.key} className={styles.period} role="button" tabIndex={0} data-sales-month={point.key} aria-label={`${point.title}. Current FY ${salesMoney(point.current)}. Previous FY ${salesMoney(point.previous)}. Show comparison.`} aria-describedby={shown?.key===point.key?id:undefined}
          onPointerDown={event=>{pointerType.current=event.pointerType;}} onPointerEnter={event=>{if(event.pointerType!=='touch'){pointerType.current=event.pointerType;show(point.key,event.currentTarget);}}} onFocus={event=>show(point.key,event.currentTarget)} onBlur={()=>setActive(null)} onClick={event=>show(point.key,event.currentTarget)}
          onKeyDown={event=>{if(event.key==='Escape'){setActive(null);return;}if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const nodes=container.current?.querySelectorAll<SVGGElement>('[data-sales-month]');const next=event.key==='Home'?0:event.key==='End'?points.length-1:(index+(event.key==='ArrowRight'?1:-1)+points.length)%points.length;nodes?.[next]?.focus();}}}>
          <rect x={index===0?left-8:(x(index-1)+x(index))/2} y={top-8} width={(index===points.length-1?width-right+8:(x(index)+x(index+1))/2)-(index===0?left-8:(x(index-1)+x(index))/2)} height={height-top-bottom+12} fill="transparent"/>
          {shown?.key===point.key&&<line x1={x(index)} x2={x(index)} y1={top} y2={height-bottom} className={styles.crosshair} strokeDasharray="3 4" pointerEvents="none"/>}
          <text x={x(index)} y={height-10} textAnchor="middle" className={styles.axis}>{point.label}</text>
        </g>)}
      </svg>
      {(pending||!hasData)&&<p className={styles.empty} role="status">{pending?'Loading selected financial year…':`Data Not Available ? ${unavailableReason??'No dated invoice sales observations exist for this financial year.'}`}</p>}
    </div>
    <div className={styles.legend}><span><i style={{background:'#2769BE'}}/>Current FY <small>{financialYear}</small></span><span><i style={{background:'#308840'}}/>Previous FY <small>{previousYear}</small></span></div>
    <p className={styles.note}>Gaps indicate unavailable or future data.{points.some(point=>point.partial)?' Current period is partial; comparison uses the API’s matching prior-year cutoff.':''}</p>
    {shown&&comparison&&active&&createPortal(<div id={id} role="tooltip" ref={tooltip} className={styles.tooltip} style={{left:placement?.left??0,top:placement?.top??0,visibility:placement?'visible':'hidden'}}>
      <strong>{shown.title}{shown.partial?' · partial':''}</strong><small>FY {financialYear} vs FY {previousYear}</small>
      <dl><dt><i style={{background:'#2769BE'}}/>Current FY Sales</dt><dd>{shownMoney(shown.current)}</dd><dt><i style={{background:'#308840'}}/>Previous FY Sales</dt><dd>{shownMoney(shown.previous)}</dd><dt>Sales Difference</dt><dd className={comparison.difference==null?'':comparison.difference>=0?styles.positive:styles.negative}>{signed(comparison.difference)}</dd><dt>YoY Growth</dt><dd className={comparison.growth==null?'':comparison.growth>=0?styles.positive:styles.negative}>{comparison.growth==null?'Data Not Available':`${comparison.growth>0?'+':''}${comparison.growth.toFixed(2)}%`}</dd></dl>
      {(shown.current==null||shown.previous==null||comparison.growth==null)&&<small>{shown.current==null||shown.previous==null?(unavailableReason??'Matching monthly invoice evidence is missing.'): 'Growth cannot be calculated because prior-period sales are zero.'}</small>}
      {shown.partial&&<small>Through {new Date(`${periodEnd<today?periodEnd:today}T00:00:00Z`).toLocaleDateString('en-IN',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'})}</small>}
    </div>,document.body)}
  </div>;
}
