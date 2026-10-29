import { attendanceMonths } from '../../shared/rm-attendance.mjs';
import { indiaBusinessDate, shiftBusinessDate } from '../../shared/business-date.mjs';

export const REPORT_DEMO_VERSION='client-showcase-v1';
export function canUseLocalReportPreview({role,audience,hostname}) {
  return role==='admin'&&audience==='admin'&&['localhost','127.0.0.1','::1','[::1]'].includes(hostname);
}
const hash=text=>{let value=2166136261;for(const char of text){value^=char.charCodeAt(0);value=Math.imul(value,16777619);}return value>>>0;};
const known=value=>typeof value==='number'&&Number.isFinite(value);

/** Explicit local Admin session only. No API parameters, persistence, or live-record mutation. */
export function localReportPreview(report,{enabled=false,role,audience,hostname,today=indiaBusinessDate(),version=REPORT_DEMO_VERSION}={}) {
  if(!report||!enabled||!canUseLocalReportPreview({role,audience,hostname})||report.selectedSalespersonId)return report;
  const fy=report.selectedPeriod.financialYear,startYear=Number(fy.slice(0,4));
  const from=`${startYear}-04-01`,to=`${startYear+1}-03-31`,seed=`${version}|${report.id}|${fy}`;
  const rows=[];
  for(let date=from;date<=to;date=shiftBusinessDate(date,1)){
    const value=hash(`${seed}|attendance|${date}`),sunday=new Date(`${date}T00:00:00Z`).getUTCDay()===0;
    if(sunday||value%100<12)continue;
    const beginMinutes=8*60+40+value%76,endMinutes=17*60+15+(value>>>8)%106;
    const instant=minutes=>new Date(Date.parse(`${date}T00:00:00Z`)+(minutes-330)*60000).toISOString();
    rows.push({id:`demo-${date}`,business_date:date,check_in_at:instant(beginMinutes),check_out_at:value%23===0?null:instant(endMinutes)});
  }
  const attendance={available:true,cutoff:to,subject:report.attendance?.subject??{name:report.name,code:report.rmCode,role:'rm'},
    months:attendanceMonths({financialYear:fy,cutoff:to,today:shiftBusinessDate(to,1),rows,policy:{weeklyHolidays:[0],absenceVerified:true,employmentFrom:from,coverageFrom:from,coverageTo:to}}),
    note:'Simulated full-FY attendance for this local demo session. Future dates are simulated examples.',
    demo:{label:'Demo Attendance',version,realToday:today},
  };
  let thrustYtd=report.thrustYtd;
  if(thrustYtd&&thrustYtd.from<=thrustYtd.to){
    const days=(Date.parse(to)-Date.parse(from))/86400000+1,elapsed=Math.max(1,Math.min(days,(Date.parse(thrustYtd.to)-Date.parse(from))/86400000+1));
    const companyNetSales=Math.round((180000000+hash(seed+'|company')%220000000)*elapsed/days);
    const products=thrustYtd.products.map(product=>{
      if(known(product.sales)&&known(product.companyContributionPercent))return product;
      const sales=Math.round((300000+hash(`${seed}|product|${product.id}`)%1800000)*elapsed/days);
      return {...product,demoMetrics:{sales,companyContributionPercent:sales/companyNetSales*100,companyNetSales,version}};
    });
    thrustYtd={...thrustYtd,products,demo:{companyNetSales,version}};
  }
  let topSales=report.topSales;
  if(report.rmCode==='033705'&&!(topSales?.products?.length)){
    const denominator=topSales?.totalSales>0?topSales.totalSales:report.summary?.actual>0?report.summary.actual:1400000;
    const names=['Acid Zinc Brightener','Pretreatment Surfactant','Zinc Blue Passivation','Chrome Catalyst','Nickel Brightener'];
    const products=[30,24,18,12,8].map((share,index)=>({id:`sample-top-product-${index+1}`,name:names[index],salesValue:Math.round(denominator*share)/100,sharePercent:share}));
    topSales={...topSales,totalSales:topSales?.totalSales??report.summary?.actual??null,customers:topSales?.customers??[],products,productDemo:{label:'Sample products ? illustrative sales and shares',version}};
  }
  if(report.rmCode==='033705'&&(topSales?.customers?.length??0)<5){
    const recorded=topSales?.customers??[];
    const base=recorded.length?Math.min(...recorded.map(row=>row.salesValue)):1000000;
    const samples=Array.from({length:5-recorded.length},(_,index)=>({id:`sample-top-customer-${index+1}`,name:`Sample Customer ${index+1}`,salesValue:Math.round((base>0?base*(.35-index*.05):base-(index+1)*1000)*100)/100,sharePercent:null,sample:true}));
    topSales={...topSales,totalSales:topSales?.totalSales??report.summary?.actual??null,products:topSales?.products??[],customers:[...recorded,...samples],customerDemo:{label:'Sample customer rows are illustrative and excluded from recorded totals and shares.',version}};
  }
  return {...report,attendance,thrustYtd,topSales,clientDemo:{label:'Demo Preview',version,scope:`${report.id}|${fy}`}};
}
