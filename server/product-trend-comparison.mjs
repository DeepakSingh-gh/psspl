import {authoritativeInvoiceWhere,netInvoiceAmount,netInvoiceLineAmount} from './tally/metrics.mjs';
import {indiaBusinessDate} from '../shared/business-date.mjs';

const monthEnd=key=>new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5)),0)).toISOString().slice(0,10);
const shiftMonth=(key,offset)=>new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5))-1+offset,1)).toISOString().slice(0,7);
const monthLabel=key=>new Date(key+'-01T00:00:00Z').toLocaleDateString('en-IN',{timeZone:'UTC',month:'short',year:'numeric'});
const group=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};

/** All comparisons are additional observations, never replacements for FY/YoY values. */
export function productTrendComparison(db,report){
 const from=report.periodStart,to=[report.periodEnd,indiaBusinessDate()].sort()[0];
 const where=`${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ?`;
 const rows=db.prepare(`SELECT l.product_name name,substr(i.invoice_date,1,7) period,
   SUM(${netInvoiceLineAmount('i','l')}) salesValue,SUM(l.quantity) quantity,
   COUNT(DISTINCT i.id) invoiceCount,MIN(i.invoice_date) firstDate,MAX(i.invoice_date) lastDate
   FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${where}
   GROUP BY l.product_name,period ORDER BY period,l.product_name`).all(from,to);
 const invoiceDates=db.prepare(`SELECT MIN(i.invoice_date) firstDate,MAX(i.invoice_date) lastDate FROM tally_invoices i WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ?`).get(from,to);
 const observedFrom=invoiceDates.firstDate??null,observedThrough=invoiceDates.lastDate??null;
 const byMonth=group(rows,row=>row.period),months=[...byMonth.keys()].sort();
 // A later invoice date bounds the recorded history. Never compare an incomplete
 // latest month with an entire preceding month or invent a missing global month.
 const currentMonth=[...months].reverse().find(key=>monthEnd(key)<=observedThrough&&byMonth.has(shiftMonth(key,-1))&&shiftMonth(key,-1)+'-01'>=from);
 const invoiceLineSales=rows.reduce((sum,row)=>sum+row.salesValue,0);
 const columns=new Set(db.prepare('PRAGMA table_info(tally_invoices)').all().map(column=>column.name));
 let reconciliation={reportedProductSales:report.summary.totalSales,invoiceLineSales,invoiceHeaderSales:null,headerLineDifference:null,invoicesWithoutLines:null,reason:'Invoice header amounts are unavailable.'};
 if(columns.has('amount')){
   const header=db.prepare(`SELECT COUNT(*) invoiceCount,COUNT(i.amount) amountCount,SUM(${netInvoiceAmount('i')}) sales,
     SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM tally_invoice_lines l WHERE l.invoice_id=i.id) THEN 1 ELSE 0 END) missingLines
     FROM tally_invoices i WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ?`).get(from,to);
   const headerSales=header.invoiceCount&&header.amountCount===header.invoiceCount?header.sales:null;
   reconciliation={...reconciliation,invoiceHeaderSales:headerSales,headerLineDifference:headerSales==null?null:headerSales-invoiceLineSales,invoicesWithoutLines:header.missingLines??0,reason:headerSales==null?'No complete invoice-header amount evidence exists.':Math.abs(headerSales-invoiceLineSales)>.01?'Product totals reconcile to item lines. Voucher-header totals differ; no tax, charge, return or missing-line allocation is assumed.':null};
 }
 const unavailable={available:false,reason:'Two consecutive, fully elapsed recorded months are required for a monthly comparison.',observedFrom,observedThrough,reconciliation};
 if(!currentMonth)return unavailable;
 const previousMonth=shiftMonth(currentMonth,-1),currentRows=byMonth.get(currentMonth),previousRows=byMonth.get(previousMonth);
 const total=list=>list.reduce((sum,row)=>sum+row.salesValue,0),currentSales=total(currentRows),previousSales=total(previousRows);
 const currentMap=new Map(currentRows.map(row=>[row.name,row])),previousMap=new Map(previousRows.map(row=>[row.name,row]));
 const fyRows=db.prepare(`SELECT l.product_name name,SUM(${netInvoiceLineAmount('i','l')}) salesValue,SUM(l.quantity) quantity,
   COUNT(DISTINCT i.id) invoiceCount,COUNT(DISTINCT i.customer_id) customerCount
   FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${where} GROUP BY l.product_name`).all(from,to);
 const fyTotal=fyRows.reduce((sum,row)=>sum+row.salesValue,0),metrics=[];
 for(const product of fyRows){
   const c=currentMap.get(product.name),p=previousMap.get(product.name),paired=Boolean(c&&p);
   metrics.push({name:product.name,paired,currentSales:c?.salesValue??null,previousSales:p?.salesValue??null,currentQuantity:c?.quantity??null,previousQuantity:p?.quantity??null,
     difference:paired?c.salesValue-p.salesValue:null,growthPercent:paired&&p.salesValue>0?(c.salesValue-p.salesValue)/p.salesValue*100:null,
     fyContributionPercent:fyTotal>0?product.salesValue/fyTotal*100:null,
     reason:!paired?'This exact product variant needs observations in both comparison months.':p.salesValue<=0?'Percentage growth requires a positive prior-month net-sales baseline.':null});
 }
 const metricMap=new Map(metrics.map(metric=>[metric.name,metric]));
 const asProduct=product=>({...product,previousSalesValue:0,previousQuantity:0,previousAvailable:false,averageRate:product.quantity>0?product.salesValue/product.quantity:null,growthPercent:null,changeValue:null,regions:[]});
 const productMap=new Map(fyRows.map(product=>[product.name,asProduct(product)]));
 const gainers=metrics.filter(m=>m.paired&&m.difference>0).sort((a,b)=>b.difference-a.difference),losers=metrics.filter(m=>m.paired&&m.difference<0).sort((a,b)=>a.difference-b.difference);
 const windowMonths=months.filter(key=>key<=currentMonth&&monthEnd(key)<=observedThrough);
 const expected=[];for(let key=windowMonths[0];key&&key<=currentMonth;key=shiftMonth(key,1))expected.push(key);
 const continuous=expected.every(key=>byMonth.has(key));
 const history=rows.filter(row=>row.period<=currentMonth),byProduct=group(history,row=>row.name);
 const firstObserved=[],noRecent=[],consistent=[];
 for(const [name,productRows] of byProduct){
   const current=currentMap.get(name),earlier=productRows.filter(row=>row.period<currentMonth&&row.salesValue>0);
   if(current?.salesValue>0&&!earlier.length)firstObserved.push(name);
   if(earlier.length&&(!current||current.salesValue<=0))noRecent.push(name);
   if(continuous&&expected.length>=2&&expected.every(month=>productRows.some(row=>row.period===month&&row.salesValue>0)))consistent.push(name);
 }
 const priorHistoryValue=name=>(byProduct.get(name)??[]).filter(row=>row.period<currentMonth).reduce((sum,row)=>sum+row.salesValue,0);
 const category=(names,field)=>({count:names.length,value:names.reduce((sum,name)=>sum+(field==='current'?currentMap.get(name)?.salesValue??0:priorHistoryValue(name)),0),items:names.sort((a,b)=>(field==='current'?currentMap.get(b)?.salesValue-currentMap.get(a)?.salesValue:priorHistoryValue(b)-priorHistoryValue(a))).slice(0,6).map(name=>({...productMap.get(name),observedWindowSales:field==='current'?currentMap.get(name).salesValue:priorHistoryValue(name)}))});
 return {available:true,reason:null,observedFrom,observedThrough,
   current:{from:currentMonth+'-01',to:monthEnd(currentMonth),label:monthLabel(currentMonth),sales:currentSales},
   previous:{from:previousMonth+'-01',to:monthEnd(previousMonth),label:monthLabel(previousMonth),sales:previousSales},
   label:`${monthLabel(currentMonth)} vs ${monthLabel(previousMonth)} (MoM)`,
   difference:currentSales-previousSales,growthPercent:previousSales>0?(currentSales-previousSales)/previousSales*100:null,
   growthReason:previousSales>0?null:'Percentage growth requires a positive prior-month net-sales baseline.',
   decliningCount:losers.length,gainers:gainers.slice(0,8).map(m=>productMap.get(m.name)),losers:losers.slice(0,15).map(m=>productMap.get(m.name)),metrics,
   lifecycle:{from:expected[0]+'-01',to:monthEnd(currentMonth),newlyObserved:category(firstObserved,'current'),noRecentSales:category(noRecent,'prior'),
     consistent:{count:continuous&&expected.length>=2?consistent.length:null,months:expected.length,reason:continuous&&expected.length>=2?null:'A consecutive multi-month observation window is required.'},
     note:'First observed means within this recorded history, not newly launched. No recent positive net sales does not establish permanent discontinuation.'},
   reconciliation};
}
