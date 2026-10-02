"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, salesApi, salesFeaturesApi } from "@/lib/api";
import { SalesSidebar } from "./sales-sidebar";
import { SalesAskAi } from "./sales-ask-ai";
import { LeadBoard } from "./lead-board";
import type { CompleteVisitPayload, SalesDay, Visit } from "@/types/sales";

const VISIT_TAGS = ["sample_required", "quotation_required", "technical_support", "complaint"] as const;
type Tab = "visits" | "pipeline" | "requests";

export function SalesWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<SalesDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUnplanned, setShowUnplanned] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [tab, setTab] = useState<Tab>("visits");
  const [requests, setRequests] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [voiceNoteVisitId, setVoiceNoteVisitId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const watchId = useRef<number | null>(null);
  const lastPingAt = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) { clearSession(); router.replace("/login"); return; }
    setError(cause instanceof Error ? cause.message : "Something went wrong");
  }

  useEffect(() => { salesApi.getMyDay().then((day) => { setData(day); if (day.salesperson.trackingActive) startTracking(); }).catch(handleError).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);
  useEffect(() => { if (tab === "requests") salesFeaturesApi.requests().then(setRequests).catch(() => {}); }, [tab]);

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
    try { if (visit.status === "planned") setData(await salesApi.startVisit(visit.id)); setSelectedVisit({ ...visit, status: "in_progress" }); setSelectedTags([]); }
    catch (e) { handleError(e); }
  }

  async function handleVisitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedVisit) return;
    const form = new FormData(event.currentTarget);
    const tags = VISIT_TAGS.filter((t) => form.getAll("visitTags").includes(t));
    const payload: CompleteVisitPayload & { visitTags?: string[] } = {
      productId: String(form.get("productId")),
      outcome: String(form.get("outcome")),
      expectedOrderValue: Number(form.get("expectedOrderValue") || 0),
      expectedOrderDate: String(form.get("expectedOrderDate") || ""),
      nextFollowUp: String(form.get("nextFollowUp")),
      notes: String(form.get("notes") || ""),
      visitTags: tags,
    };
    setSaving(true);
    try {
      setData(await salesApi.completeVisit(selectedVisit.id, payload));
      setVoiceNoteVisitId(selectedVisit.id);
      setSelectedVisit(null);
    }
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

  async function startVoiceNote() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (voiceNoteVisitId) {
          await salesFeaturesApi.uploadVoiceNote(voiceNoteVisitId, blob, "webm");
          setError("Voice note saved ✓");
        }
        setRecording(false); setVoiceNoteVisitId(null);
      };
      mr.start(); mediaRecorderRef.current = mr; setRecording(true);
    } catch { setError("Microphone permission required for voice notes"); }
  }
  function stopVoiceNote() { mediaRecorderRef.current?.stop(); }

  if (loading) return <main className="state-screen">Loading your day...</main>;
  if (!data) return <main className="state-screen error">Unable to load the CRM. {error}</main>;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "0.5rem 1rem", border: "none", background: "none", cursor: "pointer", fontWeight: tab === t ? 700 : 400,
    borderBottom: tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
    color: tab === t ? "var(--color-accent)" : "inherit",
  });

  return <div className="crm-shell">
    <SalesSidebar name={data.salesperson.name} subtitle={data.salesperson.territory} onSignOut={logout} />
    <main className="sales-main"><header className="sales-header"><div><p>PSSPL CRM · SALESPERSON</p><h1>My Day</h1></div><div className="hub-actions"><SalesAskAi /><span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(new Date())}</span></div></header>
      {!data.tally.connected && <div className="sync-banner"><b>Data source:</b> {data.tally.message} {data.tally.lastSyncAt && <span>· Loaded {new Date(data.tally.lastSyncAt).toLocaleString("en-IN")}</span>}</div>}
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
      <section className="welcome-card"><div><p>GOOD MORNING</p><h2>{data.salesperson.name}</h2><span>Plan your visits, capture discussions and close every follow-up.</span></div><div className="checkin"><div><b>{data.salesperson.checkedOutAt ? `Checked out · ${data.salesperson.checkedOutAt}` : data.salesperson.checkedInAt ? `Checked in · ${data.salesperson.checkedInAt}` : "Not checked in"}</b><small>{tracking ? "Live movement tracking active · route points saved automatically" : data.salesperson.checkedOutAt ? "Working day completed and route saved" : "Check in with location permission to begin tracking"}</small></div><button disabled={Boolean(data.salesperson.checkedInAt)} onClick={handleCheckIn}>{data.salesperson.checkedInAt ? "Checked In" : "Check In"}</button>{data.salesperson.trackingActive && <button className="secondary-action" onClick={checkOut}>Check Out</button>}</div></section>
      <section className="metrics"><Metric label="Today's visits" value={String(data.visits.length)} detail={`${data.visits.length - completed} remaining`} /><Metric label="Completed" value={String(completed)} detail="Updates RM automatically" /><Metric label="Orders expected" value={`₹${(data.summary.expectedOrderValue / 100000).toFixed(1)} L`} detail={`${data.summary.expectedOrderCount} customer commitments`} /><Metric label="Monthly target" value={achievement === null ? "No target" : `${achievement}%`} detail={`₹${data.performance.actual} Cr of ₹${data.performance.target} Cr`} /></section>

      {/* Voice note prompt */}
      {voiceNoteVisitId && !selectedVisit && (
        <div className="sync-banner" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span>Visit saved! Add a voice note? (optional)</span>
          {!recording
            ? <><button className="admin-button" style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }} onClick={startVoiceNote}>🎙 Record</button><button style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }} onClick={() => setVoiceNoteVisitId(null)}>Skip</button></>
            : <><button className="admin-button" style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", background: "#dc2626" }} onClick={stopVoiceNote}>⏹ Stop & Save</button><span style={{ fontSize: "0.8rem" }}>Recording…</span></>
          }
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", margin: "1rem 0 0 0" }}>
        <button style={tabStyle("visits")} onClick={() => setTab("visits")}>Visits & Follow-ups</button>
        <button style={tabStyle("pipeline")} onClick={() => setTab("pipeline")}>Pipeline</button>
        <button style={tabStyle("requests")} onClick={() => setTab("requests")}>Requests</button>
      </div>

      {tab === "visits" && (
        <section className="workspace-grid"><article className="workspace-card route-card"><div className="card-title"><div><p>TODAY&apos;S ROUTE</p><h3>Customer visits</h3></div><span>{data.visits.length} scheduled</span></div><div className="visit-list">{data.visits.map((visit, index) => <VisitRow key={visit.id} visit={visit} index={index} onOpen={openVisit} />)}</div><button className="outline-button" onClick={() => setShowUnplanned(true)}>+ Add unplanned visit</button></article>
          <article className="workspace-card" id="followups"><div className="card-title"><div><p>ACTION LIST</p><h3>Follow-ups due</h3></div><span>{data.followUps.filter((item) => !item.completed).length} pending</span></div><div className="followups">{data.followUps.map((item) => <label key={item.id} className={item.completed ? "done" : ""}><input type="checkbox" checked={item.completed} onChange={() => toggleFollowUp(item.id)} /><span><b>{item.title}</b><small>{item.customer} · {item.dueLabel}</small></span><em className={item.priority}>{item.priority}</em></label>)}</div></article>
          <article className="workspace-card" id="performance"><div className="card-title"><div><p>MY PERFORMANCE</p><h3>Monthly target</h3></div><strong>{achievement === null ? "No target" : `${achievement}%`}</strong></div><div className="progress"><i style={{ width: `${Math.min(achievement ?? 0, 100)}%` }} /></div><div className="performance-values"><div><span>Actual from Tally</span><b>₹{data.performance.actual} Cr</b></div><div><span>Target</span><b>{data.performance.target > 0 ? `₹${data.performance.target} Cr` : "Not set"}</b></div><div><span>Gap</span><b>₹{Math.max(data.performance.target - data.performance.actual, 0).toFixed(2)} Cr</b></div></div><p className="insight">Sales actuals are read from Tally; visits, discussions and expected orders are captured in the CRM.</p></article></section>
      )}

      {tab === "pipeline" && (
        <div style={{ padding: "1rem 0" }}>
          <LeadBoard products={data.referenceData.products} />
        </div>
      )}

      {tab === "requests" && (
        <div style={{ padding: "1rem 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Service Requests</h2>
            <button className="admin-button" onClick={() => setShowRequestForm(!showRequestForm)}>+ New Request</button>
          </div>
          {showRequestForm && (
            <RequestForm products={data.referenceData.products} customers={data.referenceData.customers} onCreated={() => { setShowRequestForm(false); salesFeaturesApi.requests().then(setRequests); }} onCancel={() => setShowRequestForm(false)} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {requests.length === 0 && <div className="admin-placeholder">No service requests yet.</div>}
            {requests.map((r: any) => (
              <div key={r.id} style={{ background: "var(--color-surface-2)", borderRadius: "8px", padding: "0.875rem", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong>{r.request_type}</strong> — {r.customer_name ?? r.lead_name ?? "General"}
                    <div style={{ fontSize: "0.8rem", color: "var(--color-text-2)", marginTop: "0.25rem" }}>{r.details}</div>
                    {r.product_name && <div style={{ fontSize: "0.75rem", color: "var(--color-text-3)" }}>Product: {r.product_name}</div>}
                    {r.due_date && <div style={{ fontSize: "0.75rem", color: r.due_date < new Date().toISOString().slice(0, 10) ? "#dc2626" : "var(--color-text-3)" }}>Due: {r.due_date}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span className={`admin-pill ${r.status === "open" ? "neutral" : "positive"}`}>{r.status}</span>
                    {r.status === "open" && <button style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer" }} onClick={() => salesFeaturesApi.setRequestStatus(r.id, "closed").then(() => salesFeaturesApi.requests().then(setRequests))}>Close</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedVisit && <div className="modal-backdrop" onMouseDown={() => setSelectedVisit(null)}><section className="visit-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelectedVisit(null)}>×</button><p>CUSTOMER VISIT</p><h2>{selectedVisit.customer}</h2><form onSubmit={handleVisitSubmit}>
        <label>Product discussed<select name="productId" defaultValue={selectedVisit.productId ?? ""} required><option value="" disabled>Select product</option>{data.referenceData.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Visit outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option>Interested - evaluation</option><option>Quotation required</option><option>Order expected</option><option>Technical support required</option><option>Not interested</option></select></label>
        <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
          <legend style={{ fontSize: "0.8rem", padding: "0 0.25rem" }}>Visit tags</legend>
          {VISIT_TAGS.map((tag) => (
            <label key={tag} style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
              <input type="checkbox" name="visitTags" value={tag} /> {tag.replace(/_/g, " ")}
            </label>
          ))}
        </fieldset>
        <div className="form-row"><label>Expected order value<input name="expectedOrderValue" type="number" min="0" placeholder="₹ Amount" /></label><label>Expected order date<input name="expectedOrderDate" type="date" /></label></div>
        <label>Next follow-up<input name="nextFollowUp" type="date" required /></label>
        <label>Discussion notes<textarea name="notes" rows={3} placeholder="What was discussed with the customer?" /></label>
        <button disabled={saving}>{saving ? "Saving..." : "Save & Complete Visit"}</button>
      </form></section></div>}

      {showUnplanned && <div className="modal-backdrop" onMouseDown={() => setShowUnplanned(false)}><section className="visit-modal" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={() => setShowUnplanned(false)}>×</button><p>UNPLANNED VISIT</p><h2>Add to today&apos;s route</h2><form onSubmit={addUnplanned}><label>Customer<select name="customerId" required><option value="">Select PSSPL customer</option>{data.referenceData.customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.city}</option>)}</select></label><label>Purpose<select name="purpose"><option>New requirement</option><option>Follow-up visit</option><option>Product discussion</option><option>Technical support</option><option>Complaint visit</option></select></label><label>Visit time<input name="scheduledAt" type="datetime-local"/></label><button>Add Visit</button></form></section></div>}
    </main>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function VisitRow({ visit, index, onOpen }: { visit: Visit; index: number; onOpen: (visit: Visit) => void }) { return <div className={`visit-row ${visit.status}`}><span className="visit-number">{visit.status === "completed" ? "✓" : index + 1}</span><div><b>{visit.customer}</b><small>{visit.time} · {visit.location}</small><em>{visit.product} · {visit.purpose}</em></div><button disabled={visit.status === "completed"} onClick={() => onOpen(visit)}>{visit.status === "completed" ? "Completed" : visit.status === "in_progress" ? "Complete" : "Start Visit"}</button></div>; }

function RequestForm({ products, customers, onCreated, onCancel }: { products: any[]; customers: any[]; onCreated: () => void; onCancel: () => void; }) {
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true);
    const form = new FormData(e.currentTarget);
    await salesFeaturesApi.addRequest({ requestType: form.get("requestType"), details: form.get("details"), customerId: form.get("customerId") || undefined, productId: form.get("productId") || undefined, dueDate: form.get("dueDate") || undefined }).finally(() => setSaving(false));
    onCreated();
  }
  return (
    <form onSubmit={submit} style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "1rem", marginBottom: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
      <label style={{ gridColumn: "1/-1" }}>Request Type<select name="requestType" required style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}><option value="">Select type</option>{["quotation", "complaint", "technical_support", "sample_request", "other"].map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Customer<select name="customerId" style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}><option value="">None</option>{customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Product<select name="productId" style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}><option value="">None</option>{products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label style={{ gridColumn: "1/-1" }}>Details *<textarea name="details" required rows={2} style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit", resize: "vertical" }} /></label>
      <label>Due Date<input name="dueDate" type="date" style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
      <div style={{ gridColumn: "1/-1", display: "flex", gap: "0.5rem" }}>
        <button type="submit" className="admin-button" disabled={saving}>{saving ? "Saving…" : "Submit Request"}</button>
        <button type="button" className="admin-button" style={{ background: "transparent", border: "1px solid var(--color-border)" }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
