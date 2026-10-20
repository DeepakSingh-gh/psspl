"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi, clearSession, salesApi, salesFeaturesApi, transcribeSpeech } from "@/lib/api";
import { SalesSidebar } from "./sales-sidebar";
import { SalesAskAi } from "./sales-ask-ai";
import { VoiceMicButton } from "@/components/common/voice-mic-button";
import { LeadBoard } from "./lead-board";
import { formatRupees } from "@/lib/format";
import type { CompleteVisitPayload, SalesDay, Visit } from "@/types/sales";

const VISIT_TAGS = ["sample_required", "quotation_required", "technical_support", "complaint"] as const;
type Tab = "visits" | "pipeline" | "requests";
const indiaDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

// ─── Animated Custom Select ────────────────────────────────────────────────
function AnimatedSelect({ name, value, onChange, options, placeholder, disabled, required }: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.55rem 0.75rem", borderRadius: "10px",
          border: open ? "1.5px solid var(--honolulu-blue)" : "1.5px solid rgba(0,124,186,0.22)",
          background: disabled ? "#f5f8fb" : "#fff",
          color: selected ? "inherit" : "#9ca3af",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "0.875rem", fontWeight: selected ? 500 : 400,
          boxShadow: open ? "0 0 0 3px rgba(0,124,186,0.12)" : "none",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          opacity: disabled ? 0.7 : 1,
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : (placeholder || "Select…")}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", marginLeft: "0.5rem", flexShrink: 0,
          fontSize: "0.7rem", color: "var(--honolulu-blue)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}>▼</span>
      </button>

      {/* Dropdown panel */}
      <div style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 999,
        background: "#fff",
        border: "1.5px solid rgba(0,124,186,0.2)",
        borderRadius: "12px",
        boxShadow: "0 12px 40px rgba(0,20,60,0.16), 0 2px 8px rgba(0,20,60,0.08)",
        overflow: "hidden",
        maxHeight: open ? "260px" : "0px",
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.95)",
        transformOrigin: "top",
        transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: open ? "auto" : "none",
        overflowY: open ? "auto" : "hidden",
      }}>
        {options.map((opt, i) => (
          <div
            key={opt.value}
            onMouseDown={() => { onChange(opt.value); setOpen(false); }}
            style={{
              padding: "0.6rem 0.85rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: opt.value === value ? 600 : 400,
              color: opt.value === value ? "var(--honolulu-blue)" : "inherit",
              background: opt.value === value ? "rgba(0,124,186,0.07)" : "transparent",
              borderBottom: i < options.length - 1 ? "1px solid rgba(0,124,186,0.06)" : "none",
              transition: "background 0.12s ease",
            }}
            onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = "rgba(0,124,186,0.04)"; }}
            onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────

export function SalesWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<SalesDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUnplanned, setShowUnplanned] = useState(false);
  const [editingUnplannedVisit, setEditingUnplannedVisit] = useState<any>(null);
  const [addingVisit, setAddingVisit] = useState(false);
  const [modalError, setModalError] = useState("");
  const [tracking, setTracking] = useState(false);
  const [tab, setTab] = useState<Tab>("visits");
  const [requests, setRequests] = useState<any[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [voiceNoteVisitId, setVoiceNoteVisitId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Unplanned visit form state
  const [uvCustomer, setUvCustomer] = useState("");
  const [uvPurpose, setUvPurpose] = useState("New requirement");
  const [uvPriority, setUvPriority] = useState("high");
  const [uvDate, setUvDate] = useState(indiaDate());
  const [uvTime, setUvTime] = useState(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  const watchId = useRef<number | null>(null);
  const lastPingAt = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingFollowUpType, setEditingFollowUpType] = useState<"call" | "visit">("call");
  const [editingPriority, setEditingPriority] = useState<string>("today");
  const [editingDueDate, setEditingDueDate] = useState<string>("");
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [newFollowUpNotes, setNewFollowUpNotes] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUpModalError, setFollowUpModalError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [savingCall, setSavingCall] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [dictatingId, setDictatingId] = useState<string | null>(null);
  const dictationRecorderRef = useRef<MediaRecorder | null>(null);

  async function startDictation(id: string) {
    if (!window.confirm("Confirm that you have permission to record and transcribe this speech.")) return;
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

  async function refreshMyDay() {
    const day = await salesApi.getMyDay();
    setData(day);
    if (day.salesperson.trackingActive) startTracking();
  }
  useEffect(() => {
    refreshMyDay().catch(handleError).finally(() => setLoading(false));
    const refresh = (event: Event) => {
      const request = event as CustomEvent<{ tasks: Promise<unknown>[] }>;
      request.detail.tasks.push(refreshMyDay().catch((cause) => { handleError(cause); throw cause; }));
    };
    window.addEventListener("psspl:refresh-data", refresh);
    return () => window.removeEventListener("psspl:refresh-data", refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);
  useEffect(() => { if (tab === "requests") salesFeaturesApi.requests().then(setRequests).catch(() => {}); }, [tab]);

  const completed = useMemo(() => data?.visits.filter((visit) => visit.status === "completed").length ?? 0, [data]);
  const achievement = data && data.performance.target > 0 ? Math.round((data.performance.actual / data.performance.target) * 100) : null;

  async function performCheckIn(coords?: { latitude: number; longitude: number; accuracy?: number }) {
    try {
      const day = await salesApi.checkIn(coords ? { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy } : undefined);
      setData(day);
      if (coords) {
        salesFeaturesApi.location({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }).catch(() => {});
        startTracking();
      } else setError("Checked in without GPS coordinates; GPS permission was denied or location was unavailable.");
    } catch (e) {
      handleError(e);
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckIn() {
    setError("");
    setCheckingIn(true);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          performCheckIn({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
        },
        () => {
          performCheckIn();
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      performCheckIn();
    }
  }

  async function openVisit(visit: Visit) {
    if (visit.status === "completed") return;
    try {
      if (visit.status === "planned") {
        let position: { latitude: number; longitude: number; accuracy?: number } | undefined;
        if (navigator.geolocation) position = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
          () => resolve(undefined), { enableHighAccuracy: true, timeout: 8000 },
        ));
        setData(await salesApi.startVisit(visit.id, position));
        if (!position) setError("Visit started without GPS coordinates; location was unavailable or permission was denied.");
      }
      setSelectedVisit({ ...visit, status: "in_progress" }); setSelectedTags([]); setVisitNotes(visit.notes || "");
    }
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
      nextFollowUpNotes: String(form.get("nextFollowUpNotes") || visitNotes || ""),
      notes: visitNotes,
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
  async function saveFollowUpNotes(id: string, notes: string, followUpType: "call" | "visit", priority?: string, dueDate?: string) {
    try {
      setData(await salesApi.updateFollowUp(id, { notes, followUpType, priority, dueDate }));
      setEditingFollowUpId(null);
    } catch (e) { handleError(e); }
  }
  async function handleAddFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFollowUpModalError("");
    setSavingFollowUp(true);
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId") || "").trim();
    const title = String(form.get("title") || "").trim();
    const dueDate = String(form.get("dueDate") || "").trim();
    if (!customerId) {
      setFollowUpModalError("Please select a customer");
      setSavingFollowUp(false);
      return;
    }
    if (!title) {
      setFollowUpModalError("Please enter a follow-up title");
      setSavingFollowUp(false);
      return;
    }
    if (!dueDate) {
      setFollowUpModalError("Please select a due date");
      setSavingFollowUp(false);
      return;
    }
    try {
      setData(await salesApi.addFollowUp({
        customerId,
        title,
        dueDate,
        priority: String(form.get("priority") || "today"),
        followUpType: (form.get("followUpType") as "call" | "visit") || "call",
        notes: String(form.get("notes") || ""),
      }));
      setShowAddFollowUp(false);
      setNewFollowUpNotes("");
    } catch (e: any) {
      setFollowUpModalError(e?.message || "Failed to save follow-up");
    } finally {
      setSavingFollowUp(false);
    }
  }
  async function handleLogCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSavingCall(true);
    try {
      await salesFeaturesApi.addCall({
        customerId: String(form.get("customerId") || ""),
        direction: String(form.get("direction") || "outgoing") as "incoming" | "outgoing",
        purpose: String(form.get("purpose") || "").trim(),
        outcome: String(form.get("outcome") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        followUpDate: String(form.get("followUpDate") || "") || undefined,
      });
      setData(await salesApi.getMyDay());
      formElement.reset();
      setCallNotes("");
      setError("Call activity saved. CRM logs are user-entered and are not verified by a phone carrier.");
    } catch (e) { handleError(e); }
    finally { setSavingCall(false); }
  }
  async function logout() { try { await authApi.logout(); } catch {} clearSession(); router.replace("/login"); }

  function startTracking() {
    if (watchId.current !== null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    try {
      watchId.current = navigator.geolocation.watchPosition(({ coords }) => {
        if (Date.now() - lastPingAt.current < 30000) return;
        lastPingAt.current = Date.now();
        salesFeaturesApi.location({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }).catch(() => {});
      }, () => { setTracking(false); setError("GPS tracking is unavailable. Check your location permission and network; recorded coordinates may be incomplete."); }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 60000 });
      setTracking(true);
    } catch {}
  }
  function stopTracking() { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); watchId.current = null; setTracking(false); }
  async function finishCheckOut(position?: GeolocationPosition) { try { const payload = position ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } : undefined; const result = await salesFeaturesApi.checkOut(payload); stopTracking(); setData(await salesApi.getMyDay()); setError(result.gpsCaptured ? "Checked out successfully; the final GPS coordinates were stored with the reported accuracy." : "Checked out successfully without a final GPS fix. Previously captured route points, if any, remain saved."); } catch (e) { handleError(e); } }
  function checkOut() { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(finishCheckOut, () => finishCheckOut(), { enableHighAccuracy: true, timeout: 10000 }); else finishCheckOut(); }
  async function addUnplanned(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError("");
    if (!editingUnplannedVisit && !uvCustomer) {
      setModalError("Please select a customer before adding a visit.");
      return;
    }
    const scheduledAt = `${uvDate}T${uvTime}:00`;
    setAddingVisit(true);
    try {
      if (editingUnplannedVisit) {
        await salesApi.updateVisit(editingUnplannedVisit.id, { purpose: uvPurpose, priority: uvPriority, scheduledAt });
      } else {
        await salesFeaturesApi.addUnplannedVisit({ customerId: uvCustomer, purpose: uvPurpose, priority: uvPriority, scheduledAt });
      }
      setShowUnplanned(false);
      setEditingUnplannedVisit(null);
      setModalError("");
      const fresh = await salesApi.getMyDay();
      setData(fresh);
    } catch (e: any) {
      setModalError(e?.message || "Failed to add visit. Please try again.");
    } finally {
      setAddingVisit(false);
    }
  }

  async function startVoiceNote() {
    if (!window.confirm("Confirm that the customer has been informed and agrees to this visit recording.")) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!blob.size) { setError("No audio was captured. You can retry the recording."); setRecording(false); return; }
        if (blob.size > 25 * 1024 * 1024) { setError("Recording exceeds the 25 MB upload limit. Record a shorter note and retry."); setRecording(false); return; }
        if (voiceNoteVisitId) {
          try { await salesFeaturesApi.uploadVoiceNote(voiceNoteVisitId, blob, "webm"); setVoiceNoteVisitId(null); }
          catch (e) { handleError(e); }
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

  
  const todayStr = indiaDate();
  const dueFollowUps = data.followUps.filter((f) => !f.dueDate || f.dueDate <= todayStr);
  const upcomingFollowUps = data.followUps.filter((f) => f.dueDate && f.dueDate > todayStr);
  const followUpGroups = [
    { title: "Follow-ups due", label: "ACTION LIST", id: "followups", followUps: dueFollowUps },
    { title: "Upcoming Follow-ups", label: "SCHEDULED", id: "upcoming-followups", followUps: upcomingFollowUps }
  ];
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
      <section className="welcome-card">
        <div>
          <p>GOOD MORNING</p>
          <h2>{data.salesperson.name}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px", marginBottom: "6px" }}>
            {data.salesperson.employeeCode && (
              <span style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "1px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                🏷️ Employee code: <strong>{data.salesperson.employeeCode}</strong>
              </span>
            )}
            {data.salesperson.managerName && <span style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "1px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>👤 Reports to: {data.salesperson.managerName}</span>}
          </div>
          {(data.salesperson.region || data.salesperson.territory) && <span style={{ display: "block", marginTop: "4px", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>{[data.salesperson.region, data.salesperson.territory].filter(Boolean).join(" · ")}</span>}
          <span style={{ display: "block", marginTop: "6px" }}>Plan your visits, capture discussions and close every follow-up.</span>
        </div>
        <div className="checkin"><div><b>{data.salesperson.checkedOutAt ? `Checked out · ${data.salesperson.checkedOutAt}` : data.salesperson.checkedInAt ? `Checked in · ${data.salesperson.checkedInAt}` : "Not checked in"}</b><small>{tracking ? "Live movement tracking active · route points saved automatically" : data.salesperson.checkedOutAt ? "Working day completed and route saved" : "Check in with location permission to begin tracking"}</small></div><button disabled={checkingIn || (Boolean(data.salesperson.checkedInAt) && !data.salesperson.checkedOutAt)} onClick={handleCheckIn} style={{ opacity: (Boolean(data.salesperson.checkedInAt) && !data.salesperson.checkedOutAt) ? 0.75 : 1 }}>{checkingIn ? "Checking In…" : (data.salesperson.checkedInAt && !data.salesperson.checkedOutAt) ? "Checked In" : "Check In"}</button>{data.salesperson.trackingActive && <button className="secondary-action" onClick={checkOut}>Check Out</button>}</div>
      </section>
      <section className="metrics">
        <Metric label="Today's visits" value={String(data.visits.length)} detail={`${data.visits.length - completed} remaining`} />
        <Metric label="Completed" value={String(completed)} detail="Updates RM automatically" />
        <Metric label="Expected today" value={`₹${(data.summary.expectedOrderValueToday / 100000).toFixed(1)} L`} detail={`${data.summary.expectedOrderCountToday} saved expectations`} />
        <Metric label="Order Expected" value={`₹${(data.summary.expectedOrderValue / 100000).toFixed(1)} L`} detail={`${data.summary.expectedOrderCount} customer commitments`} />
        <Metric
          label="Monthly target"
          value={data.performance.achievement ? `${data.performance.achievement}%` : achievement === null ? "No target" : `${achievement}%`}
          detail={data.performance.actualRupees && data.performance.targetRupees
            ? `₹${(data.performance.actualRupees / 100000).toFixed(2)} L of ₹${(data.performance.targetRupees / 100000).toFixed(2)} L`
            : data.performance.target > 0
              ? `₹${data.performance.actual} Cr of ₹${data.performance.target} Cr`
              : "Monthly target not configured"}
        />
      </section>

      <section className="panel call-log-panel" style={{ marginTop: "1rem", padding: "1.25rem" }}>
        <h2 style={{ marginTop: 0 }}>Log a customer call</h2>
        <p style={{ color: "var(--color-muted)", marginTop: 0 }}>Saved customer interaction; call connection is not technically verified.</p>
        <form className="call-log-form" onSubmit={handleLogCall}>
          <label>Customer<select name="customerId" required defaultValue=""><option value="" disabled>Select assigned customer</option>{data.referenceData.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>Call direction<select name="direction" defaultValue="outgoing"><option value="outgoing">Outgoing</option><option value="incoming">Incoming</option></select></label>
          <label>Purpose<input name="purpose" required maxLength={200} placeholder="e.g. Product enquiry" /></label>
          <label>Outcome<input name="outcome" required maxLength={300} placeholder="e.g. Quote requested" /></label>
          <label>Follow-up date <span>(optional)</span><input name="followUpDate" type="date" /></label>
          <label className="call-notes-field">Notes <span>(optional)</span><span className="call-notes-input"><textarea name="notes" value={callNotes} onChange={(event) => setCallNotes(event.target.value)} maxLength={2000} placeholder="Add notes or dictate a summary" rows={2} /><VoiceMicButton title="Dictate call notes" onTranscript={(text) => setCallNotes((previous) => previous ? `${previous} ${text}` : text)} /></span></label>
          <button type="submit" disabled={savingCall || !data.referenceData.customers.length}>{savingCall ? "Saving call…" : "Save call"}</button>
        </form>
        <div className="call-log-recent"><b>Calls logged today: {data.summary.loggedCalls}</b>
          {data.calls.length > 0 && <ul>{data.calls.slice(0, 5).map((call) => <li key={call.id}>{new Date(call.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} · {call.direction} · {call.customer} · {call.purpose}{call.notes ? ` · ${call.notes}` : ""}</li>)}</ul>}
        </div>
      </section>
      <details className="panel attendance-details" style={{ marginTop: "1rem", padding: "1rem 1.25rem" }}>
        <summary><span><b>Recent attendance</b><small>View your latest check-in and location records</small></span><span aria-hidden="true">⌄</span></summary>
        {data.attendanceHistory.length === 0 ? <p>No saved attendance history.</p> : <ul>{data.attendanceHistory.slice(0, 7).map((entry) => <li key={entry.businessDate}>{entry.businessDate} · In {new Date(entry.checkInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}{entry.checkOutAt ? ` · Out ${new Date(entry.checkOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : " · Still checked in"} · {entry.latitude === null || entry.longitude === null ? "No GPS coordinates recorded" : `GPS coordinates recorded${entry.gpsAccuracyMeters == null ? "; accuracy unavailable" : `; reported accuracy ${entry.gpsAccuracyMeters} m`}`}</li>)}</ul>}
      </details>

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

      <section className="workspace-grid"><article className="workspace-card route-card"><div className="card-title"><div><p>TODAY&apos;S ROUTE</p><h3>Customer visits</h3></div><span>{data.visits.length} scheduled</span></div><div className="visit-list">{data.visits.map((visit, index) => <VisitRow key={visit.id} visit={visit} index={index} onOpen={openVisit} onEdit={(v) => { const va = v as any; setEditingUnplannedVisit(v); setUvPurpose(v.purpose || "New requirement"); setUvPriority(v.priority || "high"); setUvDate(va.scheduledAt ? va.scheduledAt.slice(0, 10) : indiaDate()); setUvTime(va.scheduledAt ? va.scheduledAt.slice(11, 16) : new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })); setModalError(""); setShowUnplanned(true); }} onDelete={async (id) => { if(window.confirm('Delete this visit?')) { try { await salesApi.deleteVisit(id); setData(await salesApi.getMyDay()); } catch(e) { handleError(e); } } }} />)}</div><button className="outline-button" onClick={() => { setEditingUnplannedVisit(null); setUvCustomer(""); setUvPurpose("New requirement"); setUvPriority("high"); setUvDate(indiaDate()); setUvTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })); setModalError(""); setShowUnplanned(true); }}>+ Add unplanned visit</button></article>
          {followUpGroups.map(group => (
          <article key={group.title} className="workspace-card" id={group.id} style={{ overflow: "visible", marginTop: group.id === "upcoming-followups" ? "1rem" : 0 }}>
            <div className="card-title">
              <div>
                <p>{group.label}</p>
                <h3>{group.title}</h3>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span>{group.followUps.filter((item) => !item.completed).length} pending</span>
              </div>
            </div>
            <div className="followups" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {group.followUps.length === 0 && <small style={{ color: "var(--color-text-3)", fontStyle: "italic" }}>No follow-ups scheduled.</small>}
              {group.followUps.map((item) => (
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
                        <small style={{ color: "var(--color-text-2)", display: "block", marginTop: "2px" }}>{item.customer} · {item.dueLabel} {item.dueDate ? `· ${item.dueDate}` : ""}</small>
                      </div>
                    </label>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span
                        className={`priority-badge ${item.priority === 'high' ? 'high' : item.priority === 'low' ? 'low' : 'medium'}`}
                        style={{ cursor: "pointer" }}
                        title="Click to edit priority & notes"
                        onClick={() => { setEditingFollowUpId(item.id); setEditingNotes(item.notes || ""); setEditingFollowUpType(item.followUpType || "call"); setEditingPriority(item.priority || "medium"); setEditingDueDate(item.dueDate || ""); }}
                      >
                        {item.priority === 'high' ? '🔥 High' : item.priority === 'low' ? '🔹 Low' : '⚡ Medium'}
                      </span>
                      <button
                        onClick={async () => {
                          if (window.confirm("Delete this follow-up?")) {
                            try {
                              await salesApi.deleteFollowUp(item.id);
                              setData(await salesApi.getMyDay());
                            } catch(e) {
                              handleError(e);
                            }
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem", padding: "0.1rem 0.25rem", display: "flex", alignItems: "center" }}
                        title="Delete follow-up"
                      >
                        🗑️
                      </button>
                    </div>
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
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            Due:
                            <input
                              type="date"
                              value={editingDueDate}
                              onChange={(e) => setEditingDueDate(e.target.value)}
                              style={{ fontSize: "0.75rem", padding: "1px 4px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}
                            />
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
                            onClick={() => saveFollowUpNotes(item.id, editingNotes, editingFollowUpType, editingPriority, editingDueDate)}
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
                          onClick={() => { setEditingFollowUpId(item.id); setEditingNotes(item.notes || ""); setEditingFollowUpType(item.followUpType || "call"); setEditingPriority(item.priority || "medium"); setEditingDueDate(item.dueDate || ""); }}
                        >
                          ✏️ Edit Notes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {group.id === "upcoming-followups" && (
              <button
                className="outline-button"
                onClick={() => setShowAddFollowUp(true)}
              >
                + Schedule New Follow-up
              </button>
            )}
          </article>
))}

          {(() => {
            const ach = data.performance.achievement ?? achievement ?? 0;
            const isSurplus = Boolean(
              data.performance.actualRupees &&
              data.performance.targetRupees &&
              data.performance.actualRupees >= data.performance.targetRupees
            );
            const surplusRupees = isSurplus ? (data.performance.actualRupees! - data.performance.targetRupees!) : 0;
            const gapRupees = !isSurplus && data.performance.targetRupees && data.performance.actualRupees
              ? (data.performance.targetRupees - data.performance.actualRupees)
              : 0;

            return (
              <article className="workspace-card" id="performance">
                <div className="card-title">
                  <div>
                    <p>MY PERFORMANCE</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
                      <h3 style={{ margin: 0 }}>Monthly target</h3>
                      {data.performance.periodLabel && (
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--honolulu-blue, #007CBA)", background: "rgba(0, 124, 186, 0.08)", padding: "2px 8px", borderRadius: "12px", border: "1px solid rgba(0, 124, 186, 0.2)" }}>
                          📅 {data.performance.periodLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ display: "block" }}>{data.performance.achievement ? `${data.performance.achievement}%` : achievement === null ? "No target" : `${achievement}%`}</strong>
                    {ach >= 100 && (
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        ✓ Target Achieved
                      </span>
                    )}
                  </div>
                </div>
                <div className="progress">
                  <i style={{
                    width: `${Math.min(ach, 100)}%`,
                    background: ach >= 100 ? "linear-gradient(90deg, #15803d, #16a34a, #22c55e)" : undefined,
                  }} />
                </div>
                <div className="performance-values">
                  <div>
                    <span>Actual from Tally</span>
                    <b>{data.performance.actualRupees ? formatRupees(data.performance.actualRupees) : `₹${data.performance.actual} Cr`}</b>
                  </div>
                  <div>
                    <span>Target</span>
                    <b>{data.performance.targetRupees ? formatRupees(data.performance.targetRupees) : data.performance.target > 0 ? `₹${data.performance.target} Cr` : "Not set"}</b>
                  </div>
                  <div style={isSurplus ? { background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", borderColor: "#86efac" } : {}}>
                    <span>{isSurplus ? `Surplus (+${Math.max(ach - 100, 0)}%)` : "Gap"}</span>
                    <b style={isSurplus ? { color: "#15803d" } : {}}>
                      {isSurplus
                        ? `+${formatRupees(surplusRupees)}`
                        : data.performance.targetRupees && data.performance.actualRupees
                        ? formatRupees(gapRupees)
                        : data.performance.target > 0
                        ? `₹${Math.max(data.performance.target - data.performance.actual, 0).toFixed(2)} Cr`
                        : "₹0"}
                    </b>
                  </div>
                </div>
                <p className="insight">Sales actuals are read from Tally; visits, discussions and expected orders are captured in the CRM.</p>
              </article>
            );
          })()}
        </section>

      {selectedVisit && <div className="modal-backdrop" onMouseDown={() => setSelectedVisit(null)}><section className="visit-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelectedVisit(null)}>×</button><p>CUSTOMER VISIT</p><h2>{selectedVisit.customer}</h2><form onSubmit={handleVisitSubmit}>
        <div style={{ marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-text-1)" }}>Product discussed</span>
          <SearchableSelect name="productId" options={data.referenceData.products} defaultValue={selectedVisit.productId ?? ""} required />
        </div>
        <label>Visit outcome<select name="outcome" required defaultValue=""><option value="" disabled>Select outcome</option><option>Interested - evaluation</option><option>Quotation required</option><option>Expected Order</option><option>Technical support required</option><option>Not interested</option></select></label>
        <fieldset style={{ border: "1px solid var(--color-border)", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
          <legend style={{ fontSize: "0.8rem", padding: "0 0.25rem" }}>Visit tags</legend>
          {VISIT_TAGS.map((tag) => (
            <label key={tag} style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem", fontSize: "0.85rem", justifyContent: "flex-start", width: "100%" }}>
              <input type="checkbox" name="visitTags" value={tag} style={{ width: "auto", margin: 0, flexShrink: 0 }} /> 
              <span style={{ textAlign: "left" }}>{tag.replace(/_/g, " ")}</span>
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
        <label>Discussion notes / Description<div style={{ display: "flex", alignItems: "flex-start", gap: "0.35rem" }}><textarea name="nextFollowUpNotes" value={visitNotes} onChange={(event) => setVisitNotes(event.target.value)} className="followup-textarea" rows={3} placeholder="Type or dictate visit discussion notes and outcome..." /><VoiceMicButton title="Dictate visit notes" onTranscript={(text) => setVisitNotes((previous) => previous ? `${previous} ${text}` : text)} /></div></label>
        <button disabled={saving}>{saving ? "Saving..." : "Save & Complete Visit"}</button>
      </form></section></div>}

      {showAddFollowUp && (
        <div className="modal-backdrop" onMouseDown={() => { setShowAddFollowUp(false); setFollowUpModalError(""); }}>
          <section className="visit-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => { setShowAddFollowUp(false); setNewFollowUpNotes(""); setFollowUpModalError(""); }}>×</button>
            <p>NEW FOLLOW-UP</p>
            <h2>Schedule Follow-up</h2>
            {followUpModalError && (
              <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", color: "#cc1818", borderRadius: "10px", padding: "0.65rem 1rem", fontSize: "13px", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                ⚠️ {followUpModalError}
              </div>
            )}
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
                <label>Due Date<input name="dueDate" type="date" required defaultValue={indiaDate()} /></label>
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
              <button className="admin-button" disabled={savingFollowUp} style={{ marginTop: "1rem" }}>
                {savingFollowUp ? "Saving..." : "Save Follow-up"}
              </button>
            </form>
          </section>
        </div>
      )}

      {showUnplanned && (
        <div className="modal-backdrop" onMouseDown={() => { setShowUnplanned(false); setEditingUnplannedVisit(null); setModalError(""); }}>
          <section className="visit-modal" onMouseDown={e => e.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
            <button className="close" onClick={() => { setShowUnplanned(false); setEditingUnplannedVisit(null); setModalError(""); }}>×</button>
            <p>{editingUnplannedVisit ? "EDIT VISIT" : "UNPLANNED VISIT"}</p>
            <h2>{editingUnplannedVisit ? "Update details" : "Add to today's route"}</h2>

            {modalError && (
              <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", color: "#cc1818", borderRadius: "10px", padding: "0.65rem 1rem", fontSize: "13px", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                ⚠️ {modalError}
              </div>
            )}

            <form onSubmit={addUnplanned}>
              {/* Customer */}
              <label style={{ display: "grid", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "#555" }}>
                Customer
                {editingUnplannedVisit ? (
                  <div style={{ padding: "0.55rem 0.75rem", borderRadius: "10px", border: "1.5px solid rgba(0,124,186,0.15)", background: "#f5f8fb", fontSize: "0.875rem", color: "#555" }}>
                    {editingUnplannedVisit.customer}
                  </div>
                ) : (
                  <AnimatedSelect
                    name="customerId"
                    value={uvCustomer}
                    onChange={setUvCustomer}
                    placeholder="Select PSSPL customer…"
                    required
                    options={data!.referenceData.customers.map(c => ({ value: c.id, label: `${c.name} · ${c.city}` }))}
                  />
                )}
              </label>

              {/* Purpose & Priority */}
              <div className="form-row">
                <label style={{ display: "grid", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "#555" }}>
                  Purpose
                  <AnimatedSelect
                    name="purpose"
                    value={uvPurpose}
                    onChange={setUvPurpose}
                    options={[
                      { value: "New requirement", label: "New requirement" },
                      { value: "Follow-up visit", label: "Follow-up visit" },
                      { value: "Product discussion", label: "Product discussion" },
                      { value: "Technical support", label: "Technical support" },
                      { value: "Complaint visit", label: "Complaint visit" },
                    ]}
                  />
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "12.5px", fontWeight: 600, color: "#555" }}>
                  Priority
                  <AnimatedSelect
                    name="priority"
                    value={uvPriority}
                    onChange={setUvPriority}
                    options={[
                      { value: "high", label: "🔥 High" },
                      { value: "medium", label: "⚡ Medium" },
                      { value: "low", label: "🔹 Low" },
                    ]}
                  />
                </label>
              </div>

              {/* Scheduled Date & Time */}
              <div style={{ margin: "0.5rem 0", padding: "0.85rem", background: "rgba(0,124,186,0.04)", borderRadius: "12px", border: "1.5px solid rgba(0,124,186,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.65rem", fontWeight: 700, fontSize: "0.82rem", color: "#0284c7", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  📅 Scheduled Date &amp; Time
                </div>
                <div className="form-row">
                  <label style={{ margin: 0, display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#666" }}>
                    Visit Date
                    <input
                      name="visitDate" type="date" required
                      value={uvDate}
                      onChange={e => setUvDate(e.target.value)}
                      style={{ padding: "0.55rem 0.65rem", borderRadius: "8px", border: "1.5px solid rgba(0,124,186,0.3)", background: "#fff", color: "inherit", fontSize: "0.85rem", outline: "none", transition: "border-color 0.18s ease, box-shadow 0.18s ease" }}
                      onFocus={e => { e.target.style.borderColor = "var(--honolulu-blue)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,124,186,0.14)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(0,124,186,0.3)"; e.target.style.boxShadow = "none"; }}
                    />
                  </label>
                  <label style={{ margin: 0, display: "grid", gap: "5px", fontSize: "12px", fontWeight: 600, color: "#666" }}>
                    Visit Time
                    <input
                      name="visitTime" type="time" required
                      value={uvTime}
                      onChange={e => setUvTime(e.target.value)}
                      style={{ padding: "0.55rem 0.65rem", borderRadius: "8px", border: "1.5px solid rgba(0,124,186,0.3)", background: "#fff", color: "inherit", fontSize: "0.85rem", outline: "none", transition: "border-color 0.18s ease, box-shadow 0.18s ease" }}
                      onFocus={e => { e.target.style.borderColor = "var(--honolulu-blue)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,124,186,0.14)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(0,124,186,0.3)"; e.target.style.boxShadow = "none"; }}
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="admin-button"
                disabled={addingVisit}
                style={{ marginTop: "0.5rem", width: "100%", padding: "0.85rem", fontSize: "15px", opacity: addingVisit ? 0.8 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                {addingVisit ? (
                  <><span style={{ display: "inline-block", width: 16, height: 16, border: "2.5px solid rgba(255,255,255,0.4)", borderTop: "2.5px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Adding…</>
                ) : (
                  editingUnplannedVisit ? "✏️ Update Visit" : "✅ Add Visit"
                )}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function VisitRow({ visit, index, onOpen, onEdit, onDelete }: { visit: Visit; index: number; onOpen: (visit: Visit) => void; onEdit?: (visit: Visit) => void; onDelete?: (id: string) => void }) {
  const prio = visit.priority || "high";
  const badgeClass = prio === "high" ? "high" : prio === "low" ? "low" : "medium";
  const badgeText = prio === "high" ? "🔥 High" : prio === "low" ? "🔹 Low" : "⚡ Medium";

  return (
    <div className={`visit-row ${visit.status}`} style={{ display: "flex", alignItems: "center" }}>
      <span className="visit-number">{visit.status === "completed" ? "✓" : index + 1}</span>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <b>{visit.customer}</b>
          <span className={`priority-badge ${badgeClass}`}>{badgeText}</span>
        </div>
        <small>{visit.dateLabel ? `${visit.dateLabel} · ` : ""}{visit.time} · {visit.location}</small>
        <em>{visit.product} · {visit.purpose}{visit.nextFollowUpDate && visit.status === "completed" ? ` · Next Follow-up: ${visit.nextFollowUpDate}` : ""}</em>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {visit.status === "planned" && onEdit && (
          <button 
            onClick={() => onEdit(visit)} 
            style={{ background: "transparent", border: "none", color: "#0284c7", cursor: "pointer", fontSize: "1.1rem", padding: "0.25rem" }} 
            title="Edit unplanned visit"
          >
            ✏️
          </button>
        )}
        <button disabled={visit.status === "completed"} onClick={() => onOpen(visit)}>
          {visit.status === "completed" ? "Completed" : visit.status === "in_progress" ? "Complete" : "Start Visit"}
        </button>
        {onDelete && (
          <button 
            onClick={() => onDelete(visit.id)} 
            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem", padding: "0.25rem" }} 
            title="Delete visit"
          >
            🗑️
          </button>
        )}
      </div>
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

function SearchableSelect({ name, options, defaultValue, required }: { name: string; options: {id: string, name: string}[]; defaultValue?: string; required?: boolean }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultValue || "");

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 100);
    const lowerSearch = search.toLowerCase();
    return options.filter(o => o.name.toLowerCase().includes(lowerSearch)).slice(0, 100);
  }, [options, search]);

  const selectedObj = options.find(o => o.id === selected);

  return (
    <div style={{ position: "relative", marginTop: "0.25rem" }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <input type="text" name={name} value={selected} onChange={() => {}} required={required} tabIndex={-1} style={{ position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -1, top: 0, left: 0, width: "100%", height: "100%" }} />
      <div 
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(!open); } }}
        style={{ padding: "0.5rem 0.65rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "#ffffff", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", minHeight: "38px", boxSizing: "border-box" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedObj ? selectedObj.name : "Select product"}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--color-text-3)", marginLeft: "0.5rem" }}>▼</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9999, background: "#ffffff", border: "1px solid var(--color-border)", borderRadius: "6px", marginTop: "4px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)", maxHeight: "250px", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.5rem", borderBottom: "1px solid var(--color-border)", background: "#ffffff", borderRadius: "6px 6px 0 0" }}>
            <input 
              autoFocus 
              type="text" 
              placeholder="Search products..." 
              value={search} 
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.4rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "4px", fontSize: "0.85rem", outline: "none", background: "#ffffff", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "0.25rem 0", background: "#ffffff", borderRadius: "0 0 6px 6px" }}>
            {filtered.map(o => (
              <div 
                key={o.id} 
                onMouseDown={(e) => { e.preventDefault(); setSelected(o.id); setOpen(false); setSearch(""); }}
                style={{ padding: "0.4rem 0.75rem", cursor: "pointer", background: selected === o.id ? "rgba(2, 132, 199, 0.1)" : "transparent", color: selected === o.id ? "#0284c7" : "inherit", fontSize: "0.85rem" }}
                onMouseEnter={(e) => e.currentTarget.style.background = selected === o.id ? "rgba(2, 132, 199, 0.1)" : "#f8fafc"}
                onMouseLeave={(e) => e.currentTarget.style.background = selected === o.id ? "rgba(2, 132, 199, 0.1)" : "transparent"}
              >
                {o.name}
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: "0.5rem 0.75rem", color: "var(--color-text-3)", fontSize: "0.85rem" }}>No products found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
