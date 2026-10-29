import type { ThrustYtdReport } from '../../../shared/rm-performance.mjs';
import { formatDate } from '@/lib/format';

export function ThrustProductsGrid({data}:{data?:ThrustYtdReport}) {
  return <section className="rm-v2-section rm-v4-thrust" data-report-section="thrust"><div className="rm-v3-subheading"><h3>Thrust Products — YTD Performance</h3>{data&&<span>{formatDate(data.from)}–{formatDate(data.to)}</span>}</div>
    {data?.products.length?<div className="rm-v4-thrust-grid"><ThrustProductCells products={data.products}/></div>:<p className="rm-v3-inline-state">No thrust products configured for this report.</p>}
  </section>;
}

export function ThrustProductCells({products}:{products:ThrustYtdReport['products']}) {
  const value=(number:number|null,label:string,money=false)=>number==null?<span className="rm-product-unavailable" aria-label={`${label} unavailable`}><span className="sr-only">Unavailable</span><span aria-hidden="true"> </span></span>:money?`₹${(number/100000).toFixed(2)} L`:`${number.toFixed(2)}%`;
  return <>{products.map(product=>{
    const pair=product.demoMetrics,bothMissing=product.sales==null&&product.companyContributionPercent==null;
    const demoMain=!!pair&&bothMissing;
    return <article key={product.id} data-thrust-product={product.id}><strong>{product.name}</strong><p><span>YTD Sales: <b>{value(demoMain?pair!.sales:product.sales,'YTD net sales',true)}</b></span><span>Company Contribution: <b>{value(demoMain?pair!.companyContributionPercent:product.companyContributionPercent,'Company contribution')}</b></span></p>{pair&&!bothMissing&&<p className="rm-product-demo-example"><span>{value(pair.sales,'Example net sales',true)} · {value(pair.companyContributionPercent,'Example company contribution')}</span></p>}</article>;
  })}</>;
}
