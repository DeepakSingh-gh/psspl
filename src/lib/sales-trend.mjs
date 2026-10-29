const MONTHS=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const known=value=>typeof value==='number'&&Number.isFinite(value);
const monthEnd=(year,month)=>new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);

/** Calendar placement only; retain signed API amounts and distinguish missing observations. */
export function salesTrendPoints(rows,{financialYear,periodEnd,today,grain='month'}) {
  const year=Number(financialYear.slice(0,4));
  const cutoff=[periodEnd,today].filter(Boolean).sort()[0];
  const byPeriod=new Map(rows.map(row=>[row.period,row]));
  const months=MONTHS.map((label,index)=>{
    const month=(index+3)%12+1,monthYear=year+(month<4?1:0),key=`${monthYear}-${String(month).padStart(2,'0')}`;
    const from=`${key}-01`,to=monthEnd(monthYear,month),row=byPeriod.get(key),elapsed=!!cutoff&&from<=cutoff;
    return {key,label,title:new Date(`${from}T00:00:00Z`).toLocaleDateString('en-IN',{timeZone:'UTC',month:'long',year:'numeric'}),from,to,
      current:elapsed&&known(row?.salesValue)?row.salesValue:null,
      // A sparse prior aggregate is not a verified zero. New metadata is additive to the API.
      previous:elapsed&&known(row?.previousSalesValue)&&(row.previousInvoiceCount==null?row.previousSalesValue!==0:row.previousInvoiceCount>0)?row.previousSalesValue:null,
      partial:elapsed&&cutoff<to};
  });
  if(grain==='month')return months;
  return [0,1,2,3].map(index=>{
    const group=months.slice(index*3,index*3+3),elapsed=group.filter(point=>point.from<=cutoff);
    const total=field=>elapsed.length&&elapsed.every(point=>known(point[field]))?elapsed.reduce((sum,point)=>sum+point[field],0):null;
    return {key:`Q${index+1}`,label:`Q${index+1}`,title:`Q${index+1} · ${group[0].label}–${group[2].label} ${group[0].from.slice(0,4)}`,from:group[0].from,to:group[2].to,current:total('current'),previous:total('previous'),partial:elapsed.length>0&&cutoff<group[2].to};
  });
}

export function salesComparison(current,previous) {
  const difference=known(current)&&known(previous)?current-previous:null;
  return {difference,growth:difference!=null&&previous!==0?difference/previous*100:null};
}

export function salesAxis(points) {
  const values=points.flatMap(point=>[point.current,point.previous]).filter(known);
  const low=Math.min(0,...values),high=Math.max(0,...values);
  const range=high-low||1,raw=range/4,power=10**Math.floor(Math.log10(raw)),fraction=raw/power;
  const step=([1,2,2.5,5,10].find(n=>n>=fraction)??10)*power;
  const min=Math.floor(low/step)*step,max=Math.ceil((high||(!low?1:0))/step)*step;
  return {min,max,ticks:Array.from({length:Math.round((max-min)/step)+1},(_,i)=>min+i*step)};
}

export function salesMoney(value,decimals=2) {
  if(!known(value))return 'N/A';
  const n=Math.abs(value),[divisor,suffix]=n>=1e7?[1e7,'Cr']:n>=1e5?[1e5,'L']:n>=1e3?[1e3,'K']:[1,''];
  return `${value<0?'−':''}₹${(n/divisor).toLocaleString('en-IN',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}${suffix}`;
}

/** Straight segments never overshoot values or interpolate across missing months. */
export function salesLine(points,field,x,y) {
  let connected=false;
  return points.map((point,index)=>{if(!known(point[field])){connected=false;return '';}const part=`${connected?'L':'M'}${x(index)},${y(point[field])}`;connected=true;return part;}).filter(Boolean).join(' ');
}
