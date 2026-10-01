"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, salesApi, salesFeaturesApi } from "@/lib/api";
import { SalesSidebar } from "./sales-sidebar";
import { SalesAskAi } from "./sales-ask-ai";

const stages = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"];
export function SalesHub() {
  const [me, setMe] = useState<{ name: string; subtitle: string }>({ name: "Salesperson", subtitle: "" });
  const [dragging,setDragging]=useState<string|null>(null);
  const [overStage,setOverStage]=useState<string|null>(null);

  /** Moves a lead to another stage, painting the new column immediately. */
  async function moveLead(id:string,stage:string){
    const current=leads.find((lead)=>lead.id===id);
    if(!current||current.stage===stage)return;
    setLeads((rows)=>rows.map((row)=>row.id===id?{...row,stage}:row));   // optimistic
    try{await salesFeaturesApi.setLeadStage(id,stage);load()}
    catch(cause){setLeads((rows)=>rows.map((row)=>row.id===id?{...row,stage:current.stage}:row));fail(cause)}
  }
  const router = useRouter(); const [tab,setTab]=useState("customers"); const [customers,setCustomers]=useState<any[]>([]); const [leads,setLeads]=useState<any[]>([]); const [requests,setRequests]=useState<any[]>([]); const [alerts,setAlerts]=useState<any>({overdueFollowUps:[],overdueOrders:[],overdueRequests:[]}); const [selected,setSelected]=useState<any>(null); const [report,setReport]=useState<any>(null); const [answer,setAnswer]=useState(""); const [error,setError]=useState("");
  function fail(e:unknown){if(e instanceof ApiError&&e.status===401){clearSession();router.replace("/login");}else setError(e instanceof Error?e.message:"Something went wrong");}
  async function load(){try{const [c,l,r,a]=await Promise.all([salesFeaturesApi.customers(),salesFeaturesApi.leads(),salesFeaturesApi.requests(),salesFeaturesApi.alerts()]);setCustomers(c);setLeads(l);setRequests(r);setAlerts(a);}catch(e){fail(e)}}
  useEffect(()=>{salesApi.getMyDay().then((day)=>setMe({name:day.salesperson.name,subtitle:day.salesperson.territory})).catch(()=>{});const hash=window.location.hash.slice(1);if(["customers","pipeline","requests","alerts","reports"].includes(hash))setTab(hash);load()},[]); // eslint-disable-line react-hooks/exhaustive-deps
  async function addLead(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=e.currentTarget;                       // currentTarget is null after the await
    try{await salesFeaturesApi.addLead(Object.fromEntries(new FormData(form)));form.reset();load()}
    catch(cause){fail(cause)}
  }
  async function addRequest(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=e.currentTarget;
    try{await salesFeaturesApi.addRequest(Object.fromEntries(new FormData(form)));form.reset();load()}
    catch(cause){fail(cause)}
  }
  async function customerDetail(id:string){try{setSelected(await salesFeaturesApi.customer(id))}catch(e){fail(e)}}
  async function generate(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{setReport(await salesFeaturesApi.activityReport(String(f.get("from")),String(f.get("to"))))}catch(e){fail(e)}}
  async function ask(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{setAnswer((await salesFeaturesApi.askAi(String(f.get("question")))).answer)}catch(e){fail(e)}}
  async function signOut(){try{await authApi.logout();}catch{}clearSession();router.replace("/login");}
  const alertCount=alerts.overdueFollowUps.length+alerts.overdueOrders.length+alerts.overdueRequests.length;
  return <div className="crm-shell">
    <SalesSidebar name={me.name} subtitle={me.subtitle} onSignOut={signOut} />
    <main className="sales-main hub-shell"><header><div><p>PSSPL SALESPERSON WORKSPACE</p><h1>Customers, pipeline and actions</h1></div><div className="hub-actions"><SalesAskAi /><span className="alert-pill">{alertCount} overdue</span></div></header>{error&&<div className="error-banner">{error}</div>}<nav className="hub-tabs">{[["customers","Customer DB"],["pipeline","Pipeline"],["requests","Requests"],["alerts","Alerts"],["reports","Reports"]].map(([id,label])=><button className={tab===id?"active":""} onClick={()=>setTab(id)} key={id}>{label}</button>)}</nav>
    {tab==="customers"&&<section className="hub-grid"><article className="hub-card"><div className="hub-title"><div><p>CUSTOMER DATABASE</p><h2>{customers.length} PSSPL parties</h2></div><input placeholder="Search customer or city" onChange={async e=>setCustomers(await salesFeaturesApi.customers(e.target.value))}/></div><div className="customer-table">{customers.map(c=><button key={c.id} onClick={()=>customerDetail(c.id)}><span><b>{c.name}</b><small>{c.type} · {c.city}</small></span><span><strong>₹{((c.totalSales||0)/100000).toFixed(1)} L</strong><small>O/S ₹{((c.outstanding||0)/100000).toFixed(1)} L</small></span></button>)}</div></article><article className="hub-card detail-card">{selected?<><p>CUSTOMER JOURNEY</p><h2>{selected.customer.name}</h2><div className="fact-grid"><span>Type<b>{selected.customer.party_type}</b></span><span>RM<b>{selected.customer.rm_name}</b></span><span>City<b>{selected.customer.city}</b></span><span>Last payment<b>{selected.customer.last_payment_date||"—"}</b></span></div><h3>CRM activity</h3>{selected.visits.length?selected.visits.map((v:any)=><div className="timeline" key={v.id}><b>{v.purpose}</b><small>{v.business_date} · {v.status}</small></div>):<p className="empty">No CRM visits captured yet.</p>}</>:<div className="empty-state">Select a customer to view sales, outstanding, visits and requests.</div>}</article></section>}
    {tab==="pipeline"&&<section><form className="quick-form hub-card" onSubmit={addLead}><div><p>NEW LEAD</p><h2>Add prospect or enquiry</h2></div><input name="name" placeholder="Contact name" required/><input name="company" placeholder="Company"/><input name="city" placeholder="City"/><input name="phone" placeholder="Phone"/><select name="source"><option>Referral</option><option>Exhibition</option><option>Website</option><option>Field enquiry</option></select><input name="expectedValue" type="number" placeholder="Expected value"/><input name="nextActionDate" type="date"/><button>Add to pipeline</button></form><p className="kanban-hint">Drag a card to another stage, or use the dropdown on the card.</p><div className="kanban">{stages.map(stage=><div key={stage} className={overStage===stage?"kanban-col is-over":"kanban-col"} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(overStage!==stage)setOverStage(stage)}} onDragLeave={()=>setOverStage((current)=>current===stage?null:current)} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain")||dragging;setOverStage(null);setDragging(null);if(id)moveLead(id,stage)}}><h3>{stage.replaceAll("_"," ")}</h3>{leads.filter(l=>l.stage===stage).map(l=><article key={l.id} className={dragging===l.id?"is-dragging":undefined} draggable onDragStart={e=>{setDragging(l.id);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",l.id)}} onDragEnd={()=>{setDragging(null);setOverStage(null)}}><b>{l.company||l.name}</b><small>{l.city||"Location pending"}</small><span>₹{Number(l.expected_value||0).toLocaleString("en-IN")}</span><select aria-label="Pipeline stage" value={l.stage} onChange={e=>moveLead(l.id,e.target.value)}>{stages.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></article>)}</div>)}</div></section>}
    {tab==="requests"&&<section className="hub-grid"><form className="quick-form hub-card" onSubmit={addRequest}><div><p>CREATE REQUEST</p><h2>Sales support action</h2></div><select name="requestType"><option value="sample">Sample</option><option value="quotation">Quotation</option><option value="technical_support">Technical support</option><option value="complaint">Complaint</option></select><select name="customerId"><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea name="details" placeholder="Requirement details" required/><input name="responsiblePerson" placeholder="Responsible person"/><input name="dueDate" type="date"/><button>Create request</button></form><article className="hub-card"><p>OPEN ACTIONS</p><h2>Samples, quotations and support</h2>{requests.map(r=><div className="request-row" key={r.id}><span><b>{r.request_type.replaceAll("_"," ")}</b><small>{r.customer_name||r.lead_name||"Unassigned"} · {r.details}</small></span><button onClick={async()=>{await salesFeaturesApi.setRequestStatus(r.id,r.status==="open"?"closed":"open");load()}}>{r.status}</button></div>)}</article></section>}
    {tab==="alerts"&&<section className="hub-card"><p>ATTENTION REQUIRED</p><h2>Overdue commitments</h2>{alertCount===0?<div className="empty-state">No overdue actions.</div>:<>{alerts.overdueFollowUps.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.title}</b><small>{a.customer} · Due {a.due_date}</small></span><em>Follow-up</em></div>)}{alerts.overdueOrders.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.customer}</b><small>{a.product} · ₹{a.expected_value}</small></span><em>Expected order</em></div>)}{alerts.overdueRequests.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.request_type}</b><small>{a.details}</small></span><em>Support</em></div>)}</>}</section>}
    {tab==="reports"&&<section className="hub-grid"><form className="quick-form hub-card" onSubmit={generate}><div><p>ACTIVITY REPORT</p><h2>Choose any date range</h2></div><label>From<input name="from" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label>To<input name="to" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><button>Generate and save report</button></form><article className="hub-card">{report?<><p>REPORT SUMMARY</p><h2>{report.from} to {report.to}</h2><div className="fact-grid"><span>Visits<b>{report.summary.visits}</b></span><span>Completed<b>{report.summary.completed}</b></span><span>Expected value<b>₹{report.summary.expectedValue.toLocaleString("en-IN")}</b></span></div><button className="print-button" onClick={()=>window.print()}>Print / Save PDF</button></>:<div className="empty-state">Generate an end-of-day or custom-period activity report.</div>}</article></section>}
    </main>
  </div>
}
