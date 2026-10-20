"use client";
import { indiaBusinessDate } from "@/lib/business-date";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, salesApi, salesFeaturesApi } from "@/lib/api";
import { SalesSidebar } from "./sales-sidebar";
import { SalesAskAi } from "./sales-ask-ai";
import { LeadBoard } from "./lead-board";

import { VoiceMicButton } from "@/components/common/voice-mic-button";

const stages = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"];
export function SalesHub() {
  const [customerQuery, setCustomerQuery] = useState("");
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
  const router = useRouter(); const [tab,setTab]=useState("customers"); const [customers,setCustomers]=useState<any[]>([]); const [leads,setLeads]=useState<any[]>([]); const [requests,setRequests]=useState<any[]>([]); const [alerts,setAlerts]=useState<any>({pastScheduledVisits:[],overdueFollowUps:[],overdueOrders:[],overdueRequests:[]}); const [selected,setSelected]=useState<any>(null); const [report,setReport]=useState<any>(null); const [answer,setAnswer]=useState(""); const [error,setError]=useState("");
  function fail(e:unknown){if(e instanceof ApiError&&e.status===401){clearSession();router.replace("/login");}else setError(e instanceof Error?e.message:"Something went wrong");}
  async function load(){try{const [c,l,r,a]=await Promise.all([salesFeaturesApi.customers(),salesFeaturesApi.leads(),salesFeaturesApi.requests(),salesFeaturesApi.alerts()]);setCustomers(c);setLeads(l);setRequests(r);setAlerts(a);}catch(e){fail(e)}}
  useEffect(()=>{salesApi.getMyDay().then((day)=>setMe({name:day.salesperson.name,subtitle:day.salesperson.territory})).catch(()=>{});const hash=window.location.hash.slice(1);if(["customers","pipeline","requests","alerts","reports"].includes(hash))setTab(hash);load();const refresh=(event:Event)=>{const request=event as CustomEvent<{tasks:Promise<unknown>[]}>;request.detail.tasks.push(load())};window.addEventListener("psspl:refresh-data",refresh);return()=>window.removeEventListener("psspl:refresh-data",refresh)},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const [source, setSource] = useState("Referral");
  const [otherSourceText, setOtherSourceText] = useState("");
  async function addLead(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form=e.currentTarget;
    const data: Record<string, any> = Object.fromEntries(new FormData(form));
    if (source === "Other" || source === "Referral") {
      const text = otherSourceText.trim();
      if (text) {
        data.source = source === "Referral" ? `Referral (${text})` : text;
      } else {
        data.source = source;
      }
    } else {
      data.source = source;
    }
    delete data.otherSourceText;
    try{await salesFeaturesApi.addLead(data);form.reset();setSource("Referral");setOtherSourceText("");load()}
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
  const alertCount=(alerts.pastScheduledVisits?.length||0)+alerts.overdueFollowUps.length+alerts.overdueOrders.length+alerts.overdueRequests.length;
  return <div className="crm-shell">
    <SalesSidebar name={me.name} subtitle={me.subtitle} onSignOut={signOut} />
    <main className="sales-main hub-shell"><header><div><p>PSSPL SALESPERSON WORKSPACE</p><h1>Customers, pipeline and actions</h1></div><div className="hub-actions"><SalesAskAi /><span className="alert-pill">{alertCount} overdue</span></div></header>{error&&<div className="error-banner">{error}</div>}<nav className="hub-tabs">{[["customers","Customer DB"],["pipeline","Pipeline"],["requests","Requests"],["alerts","Alerts"],["reports","Reports"]].map(([id,label])=><button className={tab===id?"active":""} onClick={()=>setTab(id)} key={id}>{label}</button>)}</nav>
    {tab==="customers"&&<section className="hub-grid"><article className="hub-card"><div className="hub-title"><div><p>CUSTOMER DATABASE</p><h2>{customers.length} PSSPL parties</h2></div><div style={{ display: "flex", alignItems: "center", border: "1px solid var(--color-border, #cbd5e1)", borderRadius: "8px", padding: "0 0.4rem", background: "var(--color-surface, #ffffff)" }}><input value={customerQuery} placeholder="Search customer or city" onChange={async e=>{ setCustomerQuery(e.target.value); setCustomers(await salesFeaturesApi.customers(e.target.value)); }} style={{ border: "none", outline: "none", background: "transparent", color: "inherit", padding: "0.4rem 0", width: "100%" }}/><VoiceMicButton onTranscript={async text=>{ setCustomerQuery(text); setCustomers(await salesFeaturesApi.customers(text)); }} /></div></div><div className="customer-table">{customers.map(c=><button key={c.id} onClick={()=>customerDetail(c.id)}><span><b>{c.name}</b><small>{c.type} · {c.city}</small></span><span><strong>₹{((c.totalSales||0)/100000).toFixed(1)} L</strong><small>O/S ₹{((c.outstanding||0)/100000).toFixed(1)} L</small></span></button>)}</div></article><article className="hub-card detail-card">{selected?<><p>CUSTOMER JOURNEY</p><h2>{selected.customer.name}</h2><div className="fact-grid"><span>Type<b>{selected.customer.party_type}</b></span><span>RM<b>{selected.customer.rm_name}</b></span><span>City<b>{selected.customer.city}</b></span><span>Last payment<b>{selected.customer.last_payment_date||"—"}</b></span></div><h3>CRM activity</h3>{selected.visits.length?selected.visits.map((v:any)=><div className="timeline" key={v.id}><b>{v.purpose}</b><small>{v.business_date} · {v.status}</small></div>):<p className="empty">No CRM visits captured yet.</p>}</>:<div className="empty-state">Select a customer to view sales, outstanding, visits and requests.</div>}</article></section>}
    {tab==="pipeline"&&<section><LeadBoard /></section>}
    {tab==="requests"&&<section className="hub-grid"><form className="quick-form hub-card" onSubmit={addRequest}><div><p>CREATE REQUEST</p><h2>Sales support action</h2></div><select name="requestType"><option value="sample">Sample</option><option value="quotation">Quotation</option><option value="technical_support">Technical support</option><option value="complaint">Complaint</option></select><select name="customerId"><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><textarea name="details" placeholder="Requirement details" required/><input name="responsiblePerson" placeholder="Responsible person"/><input name="dueDate" type="date"/><button>Create request</button></form><article className="hub-card"><p>OPEN ACTIONS</p><h2>Samples, quotations and support</h2>{requests.map(r=><div className="request-row" key={r.id}><span><b>{r.request_type.replaceAll("_"," ")}</b><small>{r.customer_name||r.lead_name||"Unassigned"} · {r.details}</small></span><button onClick={async()=>{await salesFeaturesApi.setRequestStatus(r.id,r.status==="open"?"closed":"open");load()}}>{r.status}</button></div>)}</article></section>}
    {tab==="alerts"&&<section className="hub-card"><p>ATTENTION REQUIRED</p><h2>Overdue commitments</h2>{alerts.reminders&&<p>In-app reminders: {alerts.reminders.followUps.pending} pending follow-ups ({alerts.reminders.followUps.dueToday} due today); {alerts.reminders.visits.upcoming} upcoming visits; {alerts.reminders.visits.pastScheduled} past scheduled visits to confirm. External messages are separate.</p>}{alertCount===0?<div className="empty-state">No overdue actions.</div>:<>{alerts.pastScheduledVisits?.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.customer||"Customer"}: scheduled visit needs review</b><small>{a.business_date} · {a.purpose} · Status: {a.status}</small></span><em>Confirm status or reschedule</em></div>)}{alerts.overdueFollowUps.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.title}</b><small>{a.customer} · Due {a.due_date}</small></span><em>Follow-up</em></div>)}{alerts.overdueOrders.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.customer}</b><small>{a.product} · ₹{a.expected_value}</small></span><em>Expected order</em></div>)}{alerts.overdueRequests.map((a:any)=><div className="request-row" key={a.id}><span><b>{a.request_type}</b><small>{a.details}</small></span><em>Support</em></div>)}</>}</section>}
    {tab==="reports"&&<section className="hub-grid"><form className="quick-form hub-card" onSubmit={generate}><div><p>ACTIVITY REPORT</p><h2>Choose any date range</h2></div><label>From<input name="from" type="date" defaultValue={indiaBusinessDate()} required/></label><label>To<input name="to" type="date" defaultValue={indiaBusinessDate()} required/></label><button>Generate and save report</button></form><article className="hub-card">{report?<><p>REPORT SUMMARY</p><h2>{report.from} to {report.to}</h2><div className="fact-grid"><span>Visits<b>{report.summary.visits}</b></span><span>Completed<b>{report.summary.completed}</b></span><span>Expected value<b>₹{report.summary.expectedValue.toLocaleString("en-IN")}</b></span></div><button className="print-button" onClick={()=>window.print()}>Print / Save PDF</button></>:<div className="empty-state">Generate an end-of-day or custom-period activity report.</div>}</article></section>}
    </main>
  </div>
}
