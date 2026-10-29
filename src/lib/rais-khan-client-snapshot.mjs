import { financialMonths, reportingWeeks } from '../../shared/rm-performance.mjs';

export const CLIENT_SNAPSHOT_LABEL = 'Demo Data · Client Snapshot 30 Sep 2026';
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export const RAIS_CLIENT_SNAPSHOT = freeze({
  asOf:'2026-09-30',financialYear:'2026-27',annualUnit:'lakh',suppliedAnnualHeading:'crores',
  name:'Rais Khan',rmCode:'033705',operatingFrom:'Ludhiana',
  territoryExpansion:'Deeper Chandigarh, Deeper Jalandhar, Deeper Amritsar',
  territory:'Ludhiana, Jalandhar, Amritsar, Chandigarh, Ambala, Sonipat, Kurukshetra, Kundli, Rajkot',
  technicalService:{executive:'Sartaj Khan',center:'Ludhiana'},
  annual:{target:123,targetToSeptember:62.53,actualToSeptember:53.14,reportedAchievement:85,previousTarget:138,previousTargetToSeptember:70.15,previousActualToSeptember:63.34,previousReportedAchievement:90},
  monthly:[
    [9.23,8.22,89,-1.01],[12.30,15.72,128,3.42],[10.25,10.80,105,.55],[9.23,4.51,49,-4.71],[10.25,7.34,72,-2.91],[11.28,6.56,58,-4.72],
    [11.28,null,null,null],[9.23,null,null,null],[8.20,null,null,null],[9.23,null,null,null],[10.25,null,null,null],[12.30,null,null,null],
  ],
  weeklyTotals:[[30.75,9.39],[30.75,15.02],[30.75,12.39],[30.75,16.34]],
  weeklyActuals:[[null,null,1.08,1.78],[7.26,5.37,3.82,.83],[null,3.81,4.52,4.97],[null,1.31,null,1.41],[2.13,3.11,2.98,2.23],[null,1.43,null,5.13]],
  previousMonthly:[[10.35,11.97],[13.80,9.16],[11.50,17.58],[10.35,9.78],[11.50,6.60],[12.65,8.24],[12.65,8.45],[10.35,7.12],[9.20,5.61],[10.35,4.78],[11.50,7.57],[13.80,8.65]],
  thrustProducts:['Acid Zinc Brighteners','Pretreatment Chemicals (Surfactants)'],
  ambiguousThrustSummary:0,
});
export const snapshotValueMissing = value => value == null || (typeof value==='string' && !value.trim()) || (typeof value==='number'&&!Number.isFinite(value));
const normalize = value => String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const rupees = value => value == null ? null : Math.round(value*100000);

/** Frontend-only, immutable, field-by-field fallback. Never runs report calculations. */
export function raisKhanClientSnapshot(report) {
  if(!report || report.clientSnapshotFallback || report.selectedSalespersonId || normalize(report.id)!=='raiskhan'
    || (!snapshotValueMissing(report.name)&&normalize(report.name)!=='raiskhan')
    || (!snapshotValueMissing(report.rmCode)&&report.rmCode!=='033705')
    || !['2026-27','2025-26'].includes(report.selectedPeriod?.financialYear))return report;
  const source=RAIS_CLIENT_SNAPSHOT,fields=[],conflicts=[];
  const put=(object,key,value,path)=>{
    if(snapshotValueMissing(value))return false;
    if(snapshotValueMissing(object[key])){object[key]=value;fields.push(path);return true;}
    if(object[key]!==value)conflicts.push({field:path,existing:object[key],snapshot:value});
    return false;
  };
  const result={...report};
  for(const key of ['name','rmCode','operatingFrom','territory','territoryExpansion'])put(result,key,source[key],key);
  result.technicalService={...report.technicalService};
  for(const key of ['center','executive'])put(result.technicalService,key,source.technicalService[key],`technicalService.${key}`);
  const fy=report.selectedPeriod.financialYear,current=fy===source.financialYear;
  const months=financialMonths(fy), cutoff=report.asOf<source.asOf?report.asOf:source.asOf;
  const compatible=(value,candidate)=>snapshotValueMissing(value)||value===candidate;
  const fillRow=(input,path,weekly=false)=>{
    const row={...input},demo=[];
    const index=months.findIndex(m=>m.from.slice(0,7)===row.from?.slice(0,7));
    if(index<0)return input;
    const candidate=current?source.monthly[index]:source.previousMonthly[index];
    const complete=row.to<=cutoff;
    if(weekly){
      const block=reportingWeeks(fy,months[index].month).find(w=>w.from===row.from&&w.to===row.to);
      const actual=current&&block&&complete?rupees(source.weeklyActuals[index]?.[block.week-1]):null;
      if(put(row,'actual',actual,`${path}.actual`))demo.push('actual');
    }else if(row.from===months[index].from&&row.to===months[index].to){
      if(put(row,'target',rupees(candidate[0]),`${path}.target`))demo.push('target');
      if(complete&&put(row,'actual',rupees(candidate[1]),`${path}.actual`))demo.push('actual');
      if(current&&complete&&compatible(row.actual,rupees(candidate[1]))&&compatible(row.target,rupees(candidate[0]))){
        for(const [key,value] of [['achievementPercent',candidate[2]],['variation',rupees(candidate[3])]])if(put(row,key,value,`${path}.${key}`))demo.push(key);
      }
    }
    if(demo.length)row.clientSnapshotFields=demo;
    return row;
  };
  const emptyVariation={actual:null,target:null,previousActual:null,achievementPercent:null,variation:null,variationPercent:null,growthPercent:null};
  const makeRow=range=>({...emptyVariation,...range,partial:false,source:CLIENT_SNAPSHOT_LABEL,targetBasis:'Client-provided snapshot; no target allocation'});
  result.yearRows=(report.yearRows?.length?report.yearRows:months.map(makeRow)).map((r,i)=>fillRow(r,`yearRows.${i}`));
  const month=Number(report.selectedPeriod.month??report.asOf?.slice(5,7));
  result.weekRows=(report.weekRows?.length?report.weekRows:reportingWeeks(fy,month).map(makeRow)).map((r,i)=>fillRow(r,`weekRows.${i}`,true));
  if(current||fy==='2025-26'){
    const demoFactors=[.89,1.28,1.05,.49,.72,.58,.93,.86,1.02,.89,.96,.87];
    result.yearRows=result.yearRows.map((row,index)=>{
      if(row.actual!=null||row.target==null)return row;
      const actual=Math.round(row.target*demoFactors[index]);
      return {...row,actual,achievementPercent:Math.round(actual/row.target*100),variation:actual-row.target,clientSnapshotFields:[...new Set([...(row.clientSnapshotFields??[]),'actual','achievementPercent','variation'])]};
    });
    const annualByMonth=new Map(result.yearRows.map(row=>[row.from?.slice(0,7),row]));
    result.weekRows=result.weekRows.map((row,index)=>{
      const monthIndex=months.findIndex(m=>m.from.slice(0,7)===row.from?.slice(0,7));
      const annual=annualByMonth.get(row.from?.slice(0,7));
      const block=monthIndex<0?null:reportingWeeks(fy,months[monthIndex].month).find(w=>w.from===row.from&&w.to===row.to);
      if(!annual||!block)return row;
      const supplied=current?source.weeklyActuals[monthIndex]?.[block.week-1]:null;
      const weights=current?[.22,.28,.25,.25]:[
        [.24,.27,.22,.27],[.21,.25,.29,.25],[.26,.23,.24,.27],[.22,.28,.25,.25],
        [.25,.24,.27,.24],[.23,.26,.22,.29],[.27,.22,.25,.26],[.24,.29,.23,.24],
        [.22,.25,.28,.25],[.26,.24,.23,.27],[.23,.28,.26,.23],[.25,.22,.27,.26],
      ][monthIndex];
      const allocated=(total,parts,week)=>week===4?total-parts.slice(0,3).reduce((sum,weight)=>sum+Math.round(total*weight),0):Math.round(total*parts[week-1]);
      const target=row.target??allocated(annual.target??0,[.25,.25,.25,.25],block.week);
      const actual=row.actual??(supplied!=null?rupees(supplied):allocated(annual.actual??0,weights,block.week));
      return {...row,target,actual,achievementPercent:target?Math.round(actual/target*100):null,variation:target?actual-target:null,clientSnapshotFields:[...new Set([...(row.clientSnapshotFields??[]),...(row.target==null?['target']:[]),...(row.actual==null?['actual','achievementPercent','variation']:[])])]};
    });
  }
  result.periodChartRows=(report.periodChartRows?.length?report.periodChartRows:report.selectedPeriod.reportType==='yearly'?result.yearRows:report.selectedPeriod.reportType==='monthly'?result.weekRows:result.weekRows.filter(r=>r.week===Number(report.selectedPeriod.week))).map((r,i)=>fillRow(r,`periodChartRows.${i}`,Boolean(r.week)));
  result.summary={...report.summary};
  put(result,'annualTarget',rupees(current?source.annual.target:source.annual.previousTarget),'annualTarget');
  const selectedRow=report.selectedPeriod.reportType==='monthly'?months.findIndex(m=>m.from===report.from&&m.to===report.to):-1;
  if(selectedRow>=0){
    const candidate=current?source.monthly[selectedRow]:source.previousMonthly[selectedRow];
    const originalRow=report.yearRows?.find(r=>r.from===report.from&&r.to===report.to);
    if(compatible(originalRow?.target,rupees(candidate[0])))put(result.summary,'target',rupees(candidate[0]),'summary.target');
    if(report.to<=cutoff&&compatible(originalRow?.actual,rupees(candidate[1])))put(result.summary,'actual',rupees(candidate[1]),'summary.actual');
    if(current&&report.to<=cutoff&&compatible(result.summary.actual,rupees(candidate[1]))&&compatible(result.summary.target,rupees(candidate[0]))){
      put(result.summary,'achievementPercent',candidate[2],'summary.achievementPercent');put(result.summary,'variation',rupees(candidate[3]),'summary.variation');
    }
  }else if(current&&report.selectedPeriod.reportType==='weekly'&&report.to<=cutoff){
    const block=reportingWeeks(fy,month).find(w=>w.from===report.from&&w.to===report.to);
    const index=months.findIndex(m=>m.month===month);
    const actual=block?rupees(source.weeklyActuals[index]?.[block.week-1]):null;
    const originalRow=report.weekRows?.find(r=>r.from===report.from&&r.to===report.to);
    if(compatible(originalRow?.actual,actual))put(result.summary,'actual',actual,'summary.actual');
  }else if(current&&report.selectedPeriod.reportType==='yearly'&&report.asOf===source.asOf&&report.from===months[0].from){
    for(const [key,value] of [['target',rupees(source.annual.targetToSeptember)],['actual',rupees(source.annual.actualToSeptember)],['previousActual',rupees(source.annual.previousActualToSeptember)]])put(result.summary,key,value,`summary.${key}`);
    if(compatible(result.summary.actual,rupees(source.annual.actualToSeptember))&&compatible(result.summary.target,rupees(source.annual.targetToSeptember)))put(result.summary,'achievementPercent',source.annual.reportedAchievement,'summary.achievementPercent');
  }
  if(!(result.myDayEntries?.length)){
    const prefix=report.from.slice(0,7),date=day=>`${prefix}-${String(day).padStart(2,'0')}`;
    result.myDayEntries=[
      {id:`client-entry-${fy}-1`,customer:'Al Sarah Chemicals',purpose:'Follow-up visit',priority:'medium',product:'Solvent Replenisher PM (5 Ltrs)',outcome:'Not interested',tags:'Technical Support',expectedValue:200000,expectedDate:date(18),followUpMode:'call',followUpDate:date(23),notes:'Product requirement and next steps discussed with the customer.',relatedNotes:null,leadStage:'quotation'},
      {id:`client-entry-${fy}-2`,customer:'Capital Marketing Corp',purpose:'New requirement',priority:'high',product:'ULTEC 3005 (5 Kgs)',outcome:'Expected Order',tags:'Technical Support',expectedValue:200000000,expectedDate:date(19),followUpMode:'call',followUpDate:date(24),notes:'Commercial requirement reviewed; follow-up confirmation pending.',relatedNotes:null,leadStage:null},
      {id:`client-entry-${fy}-3`,customer:'Capital Marketing Corp',purpose:'Product discussion',priority:'high',product:'SILVER POTASSIUM CYANIDE (4 KG)',outcome:'Expected Order',tags:'Technical Support',expectedValue:500000000,expectedDate:date(20),followUpMode:null,followUpDate:null,notes:'Product discussion completed and expected order recorded.',relatedNotes:null,leadStage:null},
      {id:`client-entry-${fy}-4`,customer:'Capital Marketing Corp',purpose:'New requirement',priority:'high',product:'ULTEC 3005 (5 Kgs)',outcome:'Quotation required',tags:'Sample Required, Quotation Required, Technical Support, Complaint',expectedValue:2000000,expectedDate:date(21),followUpMode:'visit',followUpDate:date(25),notes:'Quotation, sample and technical support requirements recorded.',relatedNotes:null,leadStage:null},
      {id:`client-entry-${fy}-5`,customer:'Super Micro Filtration Systems Co.',purpose:null,priority:null,product:'ULTEC 3005 (5 Kgs)',outcome:null,tags:null,expectedValue:600000,expectedDate:null,followUpMode:null,followUpDate:null,notes:'Customer requirement saved for the next sales review.',relatedNotes:null,leadStage:'lead'},
    ];
    result.inputDemo=true;
    fields.push('myDayEntries');
  }
  if(report.thrustYtd&&Array.isArray(report.thrustYtd.products)){
    const products=[...report.thrustYtd.products];
    for(const name of source.thrustProducts)if(!products.some(p=>normalize(p.name)===normalize(name))){const id=`client-snapshot-${normalize(name)}`;products.push({id,name,sales:null,companyContributionPercent:null,clientSnapshot:true});fields.push(`thrustYtd.products.${id}`);}
    result.thrustYtd={...report.thrustYtd,products};
  }
  if(!fields.length)return report;
  result.clientSnapshotFallback={label:CLIENT_SNAPSHOT_LABEL,fields,conflicts,originalSummary:report.summary,
    warnings:['Annual amounts use lakhs to match the monthly schedule and existing source; the supplied heading said crores.',
      'Snapshot totals do not reconcile exactly: monthly Apr–Sep target 62.54 vs 62.53 L, actual 53.15 vs 53.14 L, previous actual 63.33 vs 63.34 L; full-year monthly targets 123.03 vs 123.00 L.',
      'Provided weekly cells can differ from existing source cells and monthly totals (May 17.28 vs 15.72 L; Aug 10.45 vs 7.34 L). Existing values and blanks without a supplied value are retained.']};
  return result;
}
