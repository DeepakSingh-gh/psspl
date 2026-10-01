"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, salesApi, salesFeaturesApi } from "@/lib/api";
import { SalesSidebar } from "./sales-sidebar";
import { SalesAskAi } from "./sales-ask-ai";
import type { CompleteVisitPayload, SalesDay, Visit } from "@/types/sales";

export function SalesWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<SalesDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUnplanned, setShowUnplanned] = useState(false);
  const [tracking, setTracking] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastPingAt = useRef(0);

  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) { clearSession(); router.replace("/login"); return; }
    setError(cause instanceof Error ? cause.message : "Something went wrong");
  }

  useEffect(() => { salesApi.getMyDay().then((day) => { setData(day); if (day.salesperson.trackingActive) startTracking(); }).catch(handleError).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);
  const completed = useMemo(() => data?.visits.filter((visit) => visit.status === "completed").length ?? 0, [data]);
  const achievement = data && data.performance.target > 0 ? Math.round((data.performance.actual / data.performance.target) * 100) : null;

  async function handleCheckIn() {
    navigator.geolocation?.getCurrentPosition(
      async ({ coords }) => { try { const day = await salesApi.checkIn({ latitude: coords.latitude, longitude: coords.longitude }); setData(day); await salesFeaturesApi.location({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }); startTracking(); } catch (e) { handleError(e); } },
      () => setError("Location permission is required to check in and track the working day"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function openVisit(visit: Visit) {
    if (visit.status === "completed") return;
    try { if (visit.status === "planned") setData(await salesApi.startVisit(visit.id)); setSelectedVisit({ ...visit, status: "in_progress" }); }
    catch (e) { handleError(e); }
  }

  async function handleVisitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedVisit) return;
    const form = new FormData(event.currentTarget);
    const payload: CompleteVisitPayload = { productId: String(form.get("productId")), outcome: String(form.get("outcome")), expectedOrderValue: Number(form.get("expectedOrderValue") || 0), expectedOrderDate: String(form.get("expectedOrderDate") || ""), nextFollowUp: String(form.get("nextFollowUp")), notes: String(form.get("notes") || "") };
    setSaving(true);
    try { setData(await salesApi.completeVisit(selectedVisit.id, payload)); setSelectedVisit(null); }
    catch (e) { handleError(e); } finally { setSaving(false); }
  }

  async function toggleFollowUp(id: string) { try { setData(await salesApi.toggleFollowUp(id)); } catch (e) { handleError(e); } }
  async function logout() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }
  function startTracking() {
    if (watchId.current !== null) return;
    if (!navigator.geolocation) { setError("Location is not supported on this device"); return; }
    watchId.current = navigator.geolocation.watchPosition(({ coords }) => {
      if (Date.now() - lastPingAt.current < 30000) return;
      lastPingAt.current = Date.now();
      salesFeaturesApi.location({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }).catch(handleError);
    }, () => setError("Location permission must remain enabled during the working day"), { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 });
    setTracking(true);
  }
  function stopTracking() { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); watchId.current = null; setTracking(false); }
  async function finishCheckOut(position?: GeolocationPosition) { try { const payload = position ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } : undefined; await salesFeaturesApi.checkOut(payload); stopTracking(); setData(await salesApi.getMyDay()); setError("Checked out successfully. Today's movement route has been saved."); } catch (e) { handleError(e); } }
  function checkOut() { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(finishCheckOut, () => finishCheckOut(), { enableHighAccuracy: true, timeout: 10000 }); else finishCheckOut(); }
  async function addUnplanned(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await salesFeaturesApi.addUnplannedVisit(Object.fromEntries(form)); setShowUnplanned(false); setData(await salesApi.getMyDay()); } catch (e) { handleError(e); } }

  if (loading) return <main className="state-screen">Loading your day...</main>;
  if (!data) return <main className="state-screen error">Unable to load the CRM. {error}</main>;

  return <div className="crm-shell">
    <SalesSidebar name={data.salesperson.name} subtitle={data.salesperson.territory} onSignOut={logout} />
    <main className="sales-main"><header className="sales-header"><div><p>PSSPL CRM · SALESPERSON</p><h1>My Day</h1></div><div className="hub-actions"><SalesAskAi /><span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(new Date())}</span></div></header>
      {!data.tally.connected && <div className="sync-banner"><b>Data source:</b> {data.tally.message} {data.tally.lastSyncAt && <span>· Loaded {new Date(data.tally.lastSyncAt).toLocaleString("en-IN")}</span>}</div>}
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
      <section className="welcome-card"><div><p>GOOD MORNING</p><h2>{data.salesperson.name}</h2><span>Plan your visits, capture discussions and close every follow-up.</span></div><div className="checkin"><div><b>{data.salesperson.checkedOutAt ? `Checked out · ${data.salesperson.checkedOutAt}` : data.salesperson.checkedInAt ? `Checked in · ${data.salesperson.checkedInAt}` : "Not checked in"}</b><small>{tracking ? "Live movement tracking active · route points saved automatically" : data.salesperson.checkedOutAt ? "Working day completed and route saved" : "Check in with location permission to begin tracking"}</small></div><button disabled={Boolean(data.salesperson.checkedInAt)} onClick={handleCheckIn}>{data.salesperson.checkedInAt ? "Checked In" : "Check In"}</button>{data.salesperson.trackingActive && <button className="secondary-action" onClick={checkOut}>Check Out</button>}</div></section>
      <section className="metrics"><Metric label="Today's visits" value={String(data.visits.length)} detail={`${data.visits.length - completed} remaining`} /><Metric label="Completed" value={String(completed)} detail="Updates RM automatically" /><Metric label="Orders expected" value={`₹${(data.summary.expectedOrderValue / 100000).toFixed(1)} L`} detail={`${data.summary.expectedOrderCount} customer commitments`} /><Metric label="Monthly target" value={achievement === null ? "No target" : `${achievement}%`} detail={`₹${data.performance.actual} Cr of ₹${data.performance.target} Cr`} /></section>
      <section className="workspace-grid"><article className="workspace-card route-card"><div className="card-title"><div><p>TODAY'S ROUTE</p><h3>Customer visits</h3></div><span>{data.visits.length} scheduled</span></div><div className="visit-list">{data.visits.map((visit, index) => <VisitRow key={visit.id} visit={visit} index={index} onOpen={openVisit} />)}</div><button className="outline-button" onClick={()=>setShowUnplanned(true)}>+ Add unplanned visit</button></article>
        <article className="workspace-card" id="followups"><div className="card-title"><div><p>ACTION LIST</p><h3>Follow-ups due</h3></div><span>{data.followUps.filter((item) => !item.completed).length} pending</span></div><div className="followups">{data.followUps.map((item) => <label key={item.id} className={item.completed ? "done" : ""}><input type="checkbox" checked={item.completed} onChange={() => toggleFollowUp(item.id)} /><span><b>{item.title}</b><small>{item.customer} · {item.dueLabel}</small></span><em className={item.priority}>{item.priority}</em></label>)}</div></article>
        <article className="workspace-card" id="performance"><div className="card-title"><div><p>MY PERFORMANCE</p><h3>Monthly target</h3></div><strong>{achievement === null ? "No target" : `${achievement}%`}</strong></div><div className="progress"><i style={{ width: `${Math.min(achievement ?? 0, 100)}%` }} /></div><div className="performance-values"><div><span>Actual from Tally</span><b>₹{data.performance.actual} Cr</b></div><div><span>Target</span><b>{data.performance.target > 0 ? `₹${data.performance.target} Cr` : "Not set"}</b></div><div><span>Gap</span><b>₹{Math.max(data.performance.target - data.performance.actual, 0).toFixed(2)} Cr</b></div></div><p className="insight">Sales actuals are read from Tally; visits, discussions and expected orders are captured in the CRM.</p></article></section>
      <section className="data-insights" id="product-trends"><article className="workspace-card"><div className="card-title"><div><p>PRODUCT TREND</p><h3>Top products · 2025–26</h3></div><span>Workbook data</span></div><div className="rank-list">{data.insights.topProducts.map((product, index) => <div key={product.name}><b>{index + 1}</b><span><strong>{product.name}</strong><small>{product.quantity.toLocaleString("en-IN")} quantity</small></span><em>₹{(product.salesValue / 100000).toFixed(2)} L</em></div>)}</div></article><article className="workspace-card" id="customers"><div className="card-title"><div><p>CUSTOMER DB</p><h3>Imported customer base</h3></div><strong>{data.insights.customerCount}</strong></div><div className="customer-facts"><div><span>Customers, dealers and exports</span><b>{data.insights.customerCount}</b></div><div><span>Outstanding recorded</span><b>₹{(data.insights.totalOutstanding / 100000).toFixed(2)} L</b></div><div><span>Available product records</span><b>{data.referenceData.products.length}</b></div></div><p className="insight">Customer codes, cities, assigned RM, monthly sales, outstanding and last-payment dates are available for reporting.</p></article></section>
    </main>
    {selectedVisit && <div className="modal-backdrop" onMouseDown={() => setSelectedVisit(null)}><section className="visit-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelectedVisit(null)}>×</button><p>CUSTOMER VISIT</p><h2>{selectedVisit.customer}</h2><form onSubmit={handleVisitSubmit}><label>Product discussed<select name="productId" defaultValue={selectedVisit.productId ?? ""} required><option value="" disabled>Select product</option>{data.referenceData.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Visit outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option>Interested - evaluation</option><option>Quotation required</option><option>Order expected</option><option>Technical support required</option><option>Not interested</option></select></label><div className="form-row"><label>Expected order value<input name="expectedOrderValue" type="number" min="0" placeholder="₹ Amount" /></label><label>Expected order date<input name="expectedOrderDate" type="date" /></label></div><label>Next follow-up<input name="nextFollowUp" type="date" required /></label><label>Discussion notes<textarea name="notes" rows={3} placeholder="What was discussed with the customer?" /></label><button disabled={saving}>{saving ? "Saving..." : "Save & Complete Visit"}</button></form></section></div>}
    {showUnplanned && <div className="modal-backdrop" onMouseDown={()=>setShowUnplanned(false)}><section className="visit-modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowUnplanned(false)}>×</button><p>UNPLANNED VISIT</p><h2>Add to today&apos;s route</h2><form onSubmit={addUnplanned}><label>Customer<select name="customerId" required><option value="">Select PSSPL customer</option>{data.referenceData.customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name} · {customer.city}</option>)}</select></label><label>Purpose<select name="purpose"><option>New requirement</option><option>Follow-up visit</option><option>Product discussion</option><option>Technical support</option><option>Complaint visit</option></select></label><label>Visit time<input name="scheduledAt" type="datetime-local"/></label><button>Add Visit</button></form></section></div>}
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function VisitRow({ visit, index, onOpen }: { visit: Visit; index: number; onOpen: (visit: Visit) => void }) { return <div className={`visit-row ${visit.status}`}><span className="visit-number">{visit.status === "completed" ? "✓" : index + 1}</span><div><b>{visit.customer}</b><small>{visit.time} · {visit.location}</small><em>{visit.product} · {visit.purpose}</em></div><button disabled={visit.status === "completed"} onClick={() => onOpen(visit)}>{visit.status === "completed" ? "Completed" : visit.status === "in_progress" ? "Complete" : "Start Visit"}</button></div>; }
