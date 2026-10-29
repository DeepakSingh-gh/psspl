import {authoritativeInvoiceWhere,netInvoiceLineAmount} from './tally/metrics.mjs';
import {productTrendComparison} from './product-trend-comparison.mjs';

const numeric=value=>typeof value==='number'&&Number.isFinite(value);
const canonical=name=>String(name??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
const group=(rows,key)=>{const map=new Map();for(const row of rows){const k=key(row);if(!map.has(k))map.set(k,[]);map.get(k).push(row);}return map;};
const fullYear=(from,to)=>from.slice(5)==='04-01'&&to===`${Number(from.slice(0,4))+1}-03-31`;
const yearOf=from=>`${from.slice(0,4)}-${String(Number(from.slice(0,4))+1).slice(-2)}`;

/** Association metadata only: grades, formulas and model codes are never removed or summed. */
export function productVariant(name){
 const unit='(?:KILOGRAMS?|KGS?|GRAMS?|GRMS?|GMS?|GM|MILLIGRAMS?|MG|LITRES?|LITERS?|LTRS?|LTS?|ML|L)';
 const measure='(?:[0-9]+(?:[.,][0-9]+)?|[.][0-9]+)\\s*(?:[X×*]\\s*[0-9]+(?:[.,][0-9]+)?\\s*)?'+unit;
 const pattern=new RegExp('(?:\\(\\s*('+measure+')\\s*\\)|\\[\\s*('+measure+')\\s*\\]|(?:\\s|-)('+measure+'))\\s*$','i');
 const match=String(name).match(pattern);const parent=match?String(name).slice(0,match.index).replace(/[\s-]+$/,''):String(name);
 return {parentName:parent||String(name),parentKey:canonical(parent||name),packingSize:match?(match[1]||match[2]||match[3]).trim():null};
}

/** Read-only enrichment scoped to Product Trends. Never adds snapshot totals to invoice totals. */
export function completeProductTrends(db,original){
 const result={...original},from=result.periodStart,to=result.periodEnd;
 const evidence=(a,b)=>db.prepare(`SELECT COUNT(*) count FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ?`).get(a,b).count;
 const currentCount=evidence(from,to),previousCount=evidence(result.previousStart,result.previousEnd);
 const history=(a,b)=>fullYear(a,b)?db.prepare('SELECT product_name name,SUM(quantity) quantity,SUM(sales_value) salesValue FROM tally_rm_product_sales WHERE financial_year=? GROUP BY product_name').all(yearOf(a)):[];
 const currentHistory=currentCount===0?history(from,to):[],priorHistory=previousCount===0?history(result.previousStart,result.previousEnd):[];
 const source=currentCount?'tally_invoices':currentHistory.length?'historical_rm_product_snapshot':null;
 const previousSource=previousCount?'tally_invoices':currentHistory.length&&priorHistory.length?'historical_rm_product_snapshot':null;
 // Annual snapshots may fill an empty complete FY, never a partial FY or a missing month.
 if(currentHistory.length){
   const prior=previousCount?db.prepare(`SELECT l.product_name name,SUM(l.quantity) quantity,SUM(${netInvoiceLineAmount('i','l')}) salesValue,COUNT(DISTINCT l.invoice_id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name`).all(result.previousStart,result.previousEnd):priorHistory;
   const currentMap=new Map(currentHistory.map(row=>[row.name,row])),priorMap=new Map(prior.map(row=>[row.name,row]));
   const products=[...new Set([...currentMap.keys(),...priorMap.keys()])].map(name=>{
     const c=currentMap.get(name),p=priorMap.get(name),salesValue=c?.salesValue??0,previousSalesValue=p?.salesValue??0,quantity=c?.quantity??0;
     return {name,salesValue,previousSalesValue,quantity,previousQuantity:p?.quantity??0,currentAvailable:Boolean(c),previousAvailable:Boolean(p),invoiceCount:null,customerCount:null,regions:[],growthPercent:c&&p&&previousSalesValue>0?Math.round((salesValue-previousSalesValue)/previousSalesValue*100):null,changeValue:c&&p?salesValue-previousSalesValue:null,averageRate:c&&quantity>0?salesValue/quantity:null,previousAverageRate:p&&p.quantity>0?previousSalesValue/p.quantity:null};
   });
   const ranked=products.filter(p=>p.salesValue>0).sort((a,b)=>b.salesValue-a.salesValue),declining=products.filter(p=>p.currentAvailable&&p.previousAvailable&&p.previousSalesValue>0&&p.salesValue<p.previousSalesValue).sort((a,b)=>a.growthPercent-b.growthPercent);
   const gainers=products.filter(p=>p.changeValue>0).sort((a,b)=>b.changeValue-a.changeValue),losers=products.filter(p=>p.changeValue<0).sort((a,b)=>a.changeValue-b.changeValue);
   const newProducts=products.filter(p=>p.currentAvailable&&!p.previousAvailable&&p.salesValue>0),stopped=products.filter(p=>!p.currentAvailable&&p.previousAvailable&&p.previousSalesValue>0);
   const total=currentHistory.reduce((sum,p)=>sum+p.salesValue,0),previousTotal=previousCount?original.summary.previousTotalSales:priorHistory.reduce((sum,p)=>sum+p.salesValue,0),rankedTotal=ranked.reduce((sum,p)=>sum+p.salesValue,0);
   const share=n=>rankedTotal>0?Math.round(ranked.slice(0,n).reduce((sum,p)=>sum+p.salesValue,0)/rankedTotal*1000)/10:null;
   Object.assign(result,{top:ranked.slice(0,15),slow:[...ranked].sort((a,b)=>a.salesValue-b.salesValue).slice(0,15),declining:declining.slice(0,15),gainers:gainers.slice(0,8),losers:losers.slice(0,8),newProducts:{count:newProducts.length,value:newProducts.reduce((sum,p)=>sum+p.salesValue,0),items:newProducts.slice(0,6)},stoppedProducts:{count:stopped.length,value:stopped.reduce((sum,p)=>sum+p.previousSalesValue,0),items:stopped.slice(0,6)},concentration:{top5:share(5),top10:share(10),top20:share(20),sellingProducts:ranked.length},summary:{...original.summary,totalSales:total,previousTotalSales:previousTotal,growthPercent:previousSource&&previousTotal>0?Math.round((total-previousTotal)/previousTotal*100):null,activeProducts:currentHistory.length,decliningProducts:declining.length}});
 }
 const priorMonthly=db.prepare(`SELECT substr(i.invoice_date,1,7) period,SUM(${netInvoiceLineAmount('i','l')}) salesValue,COUNT(DISTINCT l.invoice_id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ? GROUP BY period ORDER BY period`).all(result.previousStart,result.previousEnd);
 const seen=new Set(result.monthlyTrend.map(row=>row.period));
 // Existing rows remain byte-for-byte unchanged; recover only omitted prior-only periods.
 const extra=priorMonthly.map(row=>({...row,period:`${Number(row.period.slice(0,4))+1}${row.period.slice(4)}`})).filter(row=>!seen.has(row.period)&&`${row.period}-01`<=to).map(row=>({period:row.period,salesValue:null,quantity:null,invoiceCount:0,productCount:0,previousSalesValue:row.salesValue,previousInvoiceCount:row.invoiceCount,changePercent:null}));
 result.monthlyTrend=[...result.monthlyTrend,...extra].sort((a,b)=>a.period.localeCompare(b.period));
 const masters=db.prepare('SELECT id,name,rate,packing_size packingSize,uom FROM tally_products').all();
 const byName=group(masters,p=>canonical(p.name));
 const invoiceMonths=db.prepare(`SELECT l.product_name name,substr(i.invoice_date,1,7) period,SUM(l.quantity) quantity,SUM(${netInvoiceLineAmount('i','l')}) salesValue,COUNT(DISTINCT l.invoice_id) invoiceCount FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name,period ORDER BY period`).all(from,to);
 const monthlyByName=group(invoiceMonths,row=>row.name);
 const quantityHistory=db.prepare('SELECT p.name,m.product_id productId,m.period,m.quantity FROM tally_product_monthly_sales m JOIN tally_products p ON p.id=m.product_id WHERE m.period BETWEEN ? AND ? ORDER BY m.period').all(from.slice(0,7),to.slice(0,7));
 const quantityByName=group(quantityHistory,row=>canonical(row.name));
 const rms=currentHistory.length?db.prepare('SELECT product_name name,rm_name rmName,quantity,sales_value salesValue FROM tally_rm_product_sales WHERE financial_year=? ORDER BY rm_name').all(yearOf(from)):db.prepare(`SELECT l.product_name name,COALESCE(NULLIF(trim(c.rm_name),''),CASE WHEN owner.role='rm' THEN p.full_name ELSE manager.full_name END) rmName,SUM(l.quantity) quantity,SUM(${netInvoiceLineAmount('i','l')}) salesValue FROM tally_invoice_lines l JOIN tally_invoices i ON i.id=l.invoice_id LEFT JOIN tally_customers c ON c.id=i.customer_id LEFT JOIN users owner ON owner.id=c.owner_user_id LEFT JOIN salesperson_profiles p ON p.user_id=owner.id LEFT JOIN salesperson_profiles manager ON manager.user_id=p.manager_user_id WHERE ${authoritativeInvoiceWhere('i')} AND i.invoice_date BETWEEN ? AND ? GROUP BY l.product_name,rmName`).all(from,to).filter(row=>row.rmName);
 const rmByName=group(rms,row=>row.name);
 const enriched=new Map();
 function enrich(product){
   if(enriched.has(product.name))return enriched.get(product.name);
   const key=canonical(product.name),matching=byName.get(key)??[],variant=productVariant(product.name),monthly=[...(monthlyByName.get(product.name)??[])].map(row=>({...row,source:'tally_invoices'}));
   const periods=new Set(monthly.map(row=>row.period));
   for(const [period,rows] of group(quantityByName.get(key)??[],row=>row.period)){
     if(periods.has(period))continue;
     const quantities=[...new Set(rows.map(row=>row.quantity).filter(numeric))];
     // Multiple masters are aliases only when their observations agree. Never sum them.
     if(quantities.length===1)monthly.push({period,quantity:quantities[0],salesValue:null,invoiceCount:null,source:'stored_monthly_quantity'});
   }
   monthly.sort((a,b)=>a.period.localeCompare(b.period));
   // Connector masters default an unquoted rate to zero. Do not promote that default
   // into a missing period rate; an already populated report zero remains untouched.
   const rates=[...new Set(matching.map(row=>row.rate).filter(numeric))],rate=product.averageRate??(rates.length===1&&rates[0]!==0?rates[0]:null);
   const byRm=rmByName.get(product.name)??[];
   const unavailable={averageRate:rate==null?'No unambiguous rate or quantity-based average exists for this exact variant.':null,monthsSold:monthly.length?null:'No unambiguous dated monthly sales observations exist for this variant and FY.',monthly:monthly.length?null:'No unambiguous dated invoice or stored monthly quantity observations exist for this variant and FY.',byRm:byRm.length?null:'No RM-attributed records exist for this exact variant and selected period.',customerCount:product.customerCount==null?'Historical product totals do not contain customer identities.':null,invoiceCount:product.invoiceCount==null?'Historical product totals are not individual invoices.':null};
   const value={...product,averageRate:rate,rateSource:product.averageRate!=null?'period_average':rate!=null?'product_master':null,parentName:variant.parentName,parentKey:variant.parentKey,packingSize:variant.packingSize??matching.find(p=>p.packingSize)?.packingSize??null,masterIds:matching.map(p=>p.id),monthsSold:monthly.length?monthly.filter(row=>(row.quantity??0)>0||(row.salesValue??0)>0).length:null,monthly,byRm,source,previousAvailable:product.previousAvailable??Boolean(previousSource),unavailable};
   enriched.set(product.name,value);return value;
 }
 for(const field of ['top','slow','declining','gainers','losers'])result[field]=result[field].map(enrich);
 for(const field of ['newProducts','stoppedProducts'])result[field]={...result[field],items:result[field].items.map(enrich)};
 result.availability={source,previousSource,currentSales:Boolean(source),previousSales:Boolean(previousSource),reason:source?null:'No authoritative invoices or matching complete-FY product snapshot exists.',previousReason:previousSource?null:'No matching prior-period invoices; annual totals cannot be used for a partial-period comparison.',monthlyReason:currentCount||priorMonthly.length?'No dated observations exist for the selected month.':'No dated invoice revenue exists. Annual snapshots and quantity × master-rate valuations are not monthly invoice sales.',territoryReason:result.territories.length?null:'No verified customer-to-territory mapping is available for this period.'};
 result.recentComparison=productTrendComparison(db,result);
 if(result.recentComparison.available){
   for(const field of ['gainers','losers'])result.recentComparison[field]=result.recentComparison[field].map(enrich);
   for(const field of ['newlyObserved','noRecentSales'])result.recentComparison.lifecycle[field].items=result.recentComparison.lifecycle[field].items.map(item=>({...enrich(item),observedWindowSales:item.observedWindowSales}));
 }
 return result;
}
