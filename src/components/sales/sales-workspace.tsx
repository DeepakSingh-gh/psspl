"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, salesApi, salesFeaturesApi, transcribeSpeech } from "@/lib/api";
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

  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingFollowUpType, setEditingFollowUpType] = useState<"call" | "visit">("call");
  const [editingPriority, setEditingPriority] = useState<string>("today");
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [newFollowUpNotes, setNewFollowUpNotes] = useState("");
  const [dictatingId, setDictatingId] = useState<string | null>(null);
  const dictationRecorderRef = useRef<MediaRecorder | null>(null);

  async function startDictation(id: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        try {
          const text = await transcribeSpeech(blob);
          if (id === "new") {
            setNewFollowUpNotes((prev) => prev ? `${prev}\n${text}` : text);
          } else {
            setEditingNotes((prev) => prev ? `${prev}\n${text}` : text);
          }
        } catch (e: any) {
          setError(e.message || "Failed to transcribe voice");
        }
        setDictatingId(null);
      };
      mr.start();
      dictationRecorderRef.current = mr;
      setDictatingId(id);
    } catch {
      setError("Microphone permission required for dictation");
    }
  }
  function stopDictation() { dictationRecorderRef.current?.stop(); }

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
      nextFollowUpType: (form.get("nextFollowUpType") as "call" | "visit") || "call",
      nextFollowUpNotes: String(form.get("nextFollowUpNotes") || form.get("notes") || ""),
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
  async function saveFollowUpNotes(id: string, notes: string, followUpType: "call" | "visit", priority?: string) {
    try {
      setData(await salesApi.updateFollowUp(id, { notes, followUpType, priority }));
      setEditingFollowUpId(null);
    } catch (e) { handleError(e); }
  }
  async function handleAddFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setData(await salesApi.addFollowUp({
        customerId: String(form.get("customerId")),
        title: String(form.get("title")),
        dueDate: String(form.get("dueDate")),
        priority: String(form.get("priority") || "today"),
        followUpType: (form.get("followUpType") as "call" | "visit") || "call",
        notes: String(form.get("notes") || ""),
      }));
      setShowAddFollowUp(false);
      setNewFollowUpNotes("");
    } catch (e) { handleError(e); }
  }
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
  async function addUnplanned(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId"));
    const purpose = String(form.get("purpose"));
    const priority = String(form.get("priority") || "medium");
    const visitDate = String(form.get("visitDate") || new Date().toISOString().slice(0, 10));
    const visitTime = String(form.get("visitTime") || "10:00");
    const scheduledAt = `${visitDate}T${visitTime}`;
    try {
      await salesFeaturesApi.addUnplannedVisit({ customerId, purpose, priority, scheduledAt });
      setShowUnplanned(false);
      setData(await salesApi.getMyDay());
    } catch (e) { handleError(e); }
  }

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
      <section className="metrics"><Metric label="Today's visits" value={String(data.visits.length)} detail={`${data.visits.length - completed} remaining`} /><Metric label="Completed" value={String(completed)} detail="Updates RM automatically" /><Metric label="Order Expected" value={`₹${(data.summary.expectedOrderValue / 100000).toFixed(1)} L`} detail={`${data.summary.expectedOrderCount} customer commitments`} /><Metric label="Monthly target" value={achievement === null ? "No target" : `${achievement}%`} detail={`₹${data.performance.actual} Cr of ₹${data.performance.target} Cr`} /></section>

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
          <article className="workspace-card" id="followups" style={{ overflow: "visible" }}>
            <div className="card-title">
              <div>
                <p>ACTION LIST</p>
                <h3>Follow-ups due</h3>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span>{data.followUps.filter((item) => !item.completed).length} pending</span>
                <button className="admin-button" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => setShowAddFollowUp(true)}>+ New</button>
              </div>
            </div>
            <div className="followups" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {data.followUps.length === 0 && <small style={{ color: "var(--color-text-3)", fontStyle: "italic" }}>No follow-ups scheduled.</small>}
              {data.followUps.map((item) => (
                <div key={item.id} style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "0.75rem", opacity: item.completed ? 0.65 : 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", flex: 1 }}>
                      <input type="checkbox" checked={item.completed} onChange={() => toggleFollowUp(item.id)} style={{ marginTop: "3px" }} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <b style={{ textDecoration: item.completed ? "line-through" : "none" }}>{item.title}</b>
                          <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: "12px", background: item.followUpType === "visit" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)", color: item.followUpType === "visit" ? "#059669" : "#2563eb", fontWeight: 600 }}>
                            {item.followUpType === "visit" ? "🚗 Field Visit" : "📞 Phone Call"}
                          </span>
                        </div>
                        <small style={{ color: "var(--color-text-2)", display: "block", marginTop: "2px" }}>{item.customer} · {item.dueLabel}</small>
                      </div>
                    </label>
                    <span
                      className={`priority-badge ${item.priority === 'high' ? 'high' : item.priority === 'low' ? 'low' : 'medium'}`}
                      style={{ cursor: "pointer" }}
                      title="Click to edit priority & notes"
                      onClick={() => { setEditingFollowUpId(item.id); setEditingNotes(item.notes || ""); setEditingFollowUpType(item.followUpType || "call"); setEditingPriority(item.priority || "medium"); }}
                    >
                      {item.priority === 'high' ? '🔥 High' : item.priority === 'low' ? '🔹 Low' : '⚡ Medium'}
                    </span>
                  </div>

                  {/* Discussion Description Box */}
                  <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px dashed var(--color-border)" }}>
                    {editingFollowUpId === item.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--color-text-2)" }}>
                          <span>Follow-up mode:</span>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", cursor: "pointer" }}>
                            <input type="radio" name={`type_${item.id}`} checked={editingFollowUpType === "call"} onChange={() => setEditingFollowUpType("call")} /> 📞 Call
                          </label>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", cursor: "pointer" }}>
                            <input type="radio" name={`type_${item.id}`} checked={editingFollowUpType === "visit"} onChange={() => setEditingFollowUpType("visit")} /> 🚗 Field Visit
                          </label>
                          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            Priority:
                            <select
                              value={editingPriority}
                              onChange={(e) => setEditingPriority(e.target.value)}
                              style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit", fontWeight: 600 }}
                            >
                              <option value="high">🔥 High</option>
                              <option value="medium">⚡ Medium</option>
                              <option value="low">🔹 Low</option>
                            </select>
                          </span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            placeholder="Write down today's follow-up discussion details & outcome..."
                            rows={2}
                            className="followup-textarea"
                          />
                          <button
                            type="button"
                            onClick={dictatingId === item.id ? stopDictation : () => startDictation(item.id)}
                            style={{
                              position: "absolute",
                              right: "8px",
                              bottom: "8px",
                              background: dictatingId === item.id ? "#ef4444" : "#f1f5f9",
                              color: dictatingId === item.id ? "#fff" : "#475569",
                              border: "none",
                              borderRadius: "50%",
                              width: "32px",
                              height: "32px",
                              display: "grid",
                              placeItems: "center",
                              cursor: "pointer",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                              fontSize: "14px"
                            }}
                            title={dictatingId === item.id ? "Stop Dictation" : "Voice Dictation"}
                          >
                            {dictatingId === item.id ? "⏹" : "🎙️"}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
                          <button
                            type="button"
                            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", border: "1px solid var(--color-border)", borderRadius: "6px", background: "transparent", color: "var(--color-text-2)", cursor: "pointer" }}
                            onClick={() => setEditingFollowUpId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", border: "none", borderRadius: "6px", background: "#0284c7", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}
                            onClick={() => saveFollowUpNotes(item.id, editingNotes, editingFollowUpType, editingPriority)}
                          >
                            Save Notes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="followup-notes-display">
                        <p style={{ fontSize: "0.8rem", color: item.notes ? "inherit" : "var(--color-text-3)", fontStyle: item.notes ? "normal" : "italic", margin: 0, flex: 1, whiteSpace: "pre-wrap" }}>
                          💬 {item.notes ? item.notes : "No discussion notes written yet."}
                        </p>
                        <button
                          type="button"
                          style={{ fontSize: "0.7rem", padding: "2px 8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", borderRadius: "4px", cursor: "pointer", color: "#0284c7", fontWeight: 600, flexShrink: 0 }}
                          onClick={() => { setEditingFollowUpId(item.id); setEditingNotes(item.notes || ""); setEditingFollowUpType(item.followUpType || "call"); setEditingPriority(item.priority || "today"); }}
                        >
                          ✏️ Edit Notes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
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
        <label>Visit outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option>Interested - evaluation</option><option>Quotation required</option><option>Expected Order</option><option>Technical support required</option><option>Not interested</option></select></label>
        <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
          <legend style={{ fontSize: "0.8rem", padding: "0 0.25rem" }}>Visit tags</legend>
          {VISIT_TAGS.map((tag) => (
            <label key={tag} style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem", fontSize: "0.85rem" }}>
              <input type="checkbox" name="visitTags" value={tag} /> {tag.replace(/_/g, " ")}
            </label>
          ))}
        </fieldset>
        <div className="form-row"><label>Expected order value<input name="expectedOrderValue" type="number" min="0" placeholder="₹ Amount" /></label><label>Expected order date<input name="expectedOrderDate" type="date" /></label></div>
        <div className="form-row">
          <label>
            Next follow-up mode
            <select name="nextFollowUpType" defaultValue="call" style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}>
              <option value="call">📞 Phone Call</option>
              <option value="visit">🚗 Field Visit</option>
            </select>
          </label>
          <label>Next follow-up date<input name="nextFollowUp" type="date" required /></label>
        </div>
        <label>Discussion notes / Description<textarea name="nextFollowUpNotes" className="followup-textarea" rows={3} placeholder="Write down today's follow-up discussion points & outcome..." /></label>
        <button disabled={saving}>{saving ? "Saving..." : "Save & Complete Visit"}</button>
      </form></section></div>}

      {showAddFollowUp && (
        <div className="modal-backdrop" onMouseDown={() => setShowAddFollowUp(false)}>
          <section className="visit-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => { setShowAddFollowUp(false); setNewFollowUpNotes(""); }}>×</button>
            <p>NEW FOLLOW-UP</p>
            <h2>Schedule Follow-up</h2>
            <form onSubmit={handleAddFollowUp}>
              <label>
                Customer
                <select name="customerId" required style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}>
                  <option value="">Select PSSPL customer</option>
                  {data.referenceData.customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.city}</option>
                  ))}
                </select>
              </label>
              <label>Follow-up Title<input name="title" placeholder="e.g. Discuss revised quotation" required /></label>
              <div className="form-row">
                <label>
                  Follow-up Mode
                  <select name="followUpType" defaultValue="call" style={{ width: "100%", marginTop: "0.25rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}>
                    <option value="call">📞 Phone Call</option>
                    <option value="visit">🚗 Field Visit</option>
                  </select>
                </label>
                <label>Due Date<input name="dueDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              </div>
              <label>Discussion Description / Notes
                <div style={{ position: "relative", marginTop: "0.25rem" }}>
                  <textarea name="notes" value={newFollowUpNotes} onChange={(e) => setNewFollowUpNotes(e.target.value)} className="followup-textarea" rows={3} placeholder="Write down discussion details or preparation notes..." style={{ width: "100%", boxSizing: "border-box" }} />
                  <button
                    type="button"
                    onClick={dictatingId === "new" ? stopDictation : () => startDictation("new")}
                    style={{
                      position: "absolute",
                      right: "8px",
                      bottom: "8px",
                      background: dictatingId === "new" ? "#ef4444" : "#f1f5f9",
                      color: dictatingId === "new" ? "#fff" : "#475569",
                      border: "none",
                      borderRadius: "50%",
                      width: "32px",
                      height: "32px",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      fontSize: "14px"
                    }}
                    title={dictatingId === "new" ? "Stop Dictation" : "Voice Dictation"}
                  >
                    {dictatingId === "new" ? "⏹" : "🎙️"}
                  </button>
                </div>
              </label>
              <button className="admin-button" style={{ marginTop: "1rem" }}>Save Follow-up</button>
            </form>
          </section>
        </div>
      )}

      {showUnplanned && (
        <div className="modal-backdrop" onMouseDown={() => setShowUnplanned(false)}>
          <section className="visit-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="close" onClick={() => setShowUnplanned(false)}>×</button>
            <p>UNPLANNED VISIT</p>
            <h2>Add to today&apos;s route</h2>
            <form onSubmit={addUnplanned}>
              <label>
                Customer
                <select name="customerId" required style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--line)", background: "white", color: "inherit" }}>
                  <option value="">Select PSSPL customer</option>
                  {data.referenceData.customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name} · {customer.city}</option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Purpose
                  <select name="purpose" style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--line)", background: "white", color: "inherit" }}>
                    <option>New requirement</option>
                    <option>Follow-up visit</option>
                    <option>Product discussion</option>
                    <option>Technical support</option>
                    <option>Complaint visit</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select name="priority" defaultValue="high" style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--line)", background: "white", color: "inherit" }}>
                    <option value="high">🔥 High</option>
                    <option value="medium">⚡ Medium</option>
                    <option value="low">🔹 Low</option>
                  </select>
                </label>
              </div>

              {/* Scheduled Date & Time Container */}
              <div style={{ margin: "0.75rem 0", padding: "0.85rem", background: "rgba(2, 132, 199, 0.04)", borderRadius: "10px", border: "1.5px solid rgba(2, 132, 199, 0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", fontWeight: 700, fontSize: "0.85rem", color: "#0284c7" }}>
                  <span>📅 Scheduled Date & Time</span>
                </div>
                <div className="form-row">
                  <label style={{ margin: 0 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-2)", display: "block", marginBottom: "4px" }}>Visit Date</span>
                    <input name="visitDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1.5px solid #0284c7", background: "#ffffff", color: "inherit", fontSize: "0.85rem", outline: "none" }} />
                  </label>
                  <label style={{ margin: 0 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-2)", display: "block", marginBottom: "4px" }}>Visit Time</span>
                    <input name="visitTime" type="time" required defaultValue={new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1.5px solid #0284c7", background: "#ffffff", color: "inherit", fontSize: "0.85rem", outline: "none" }} />
                  </label>
                </div>
              </div>

              <button className="admin-button" style={{ marginTop: "0.25rem" }}>Add Visit</button>
            </form>
          </section>
        </div>
      )}
    </main>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function VisitRow({ visit, index, onOpen }: { visit: Visit; index: number; onOpen: (visit: Visit) => void }) {
  const prio = visit.priority || "high";
  const badgeClass = prio === "high" ? "high" : prio === "low" ? "low" : "medium";
  const badgeText = prio === "high" ? "🔥 High" : prio === "low" ? "🔹 Low" : "⚡ Medium";

  return (
    <div className={`visit-row ${visit.status}`}>
      <span className="visit-number">{visit.status === "completed" ? "✓" : index + 1}</span>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <b>{visit.customer}</b>
          <span className={`priority-badge ${badgeClass}`}>{badgeText}</span>
        </div>
        <small>{visit.time} · {visit.location}</small>
        <em>{visit.product} · {visit.purpose}</em>
      </div>
      <button disabled={visit.status === "completed"} onClick={() => onOpen(visit)}>
        {visit.status === "completed" ? "Completed" : visit.status === "in_progress" ? "Complete" : "Start Visit"}
      </button>
    </div>
  );
}

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
