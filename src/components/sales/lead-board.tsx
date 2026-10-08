"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { salesFeaturesApi } from "@/lib/api";
import { formatRupees } from "@/lib/format";

const STAGES = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  lead: "New Lead", technical_discussion: "Tech Discussion", sample: "Sample",
  quotation: "Quotation", follow_up: "Follow-up", expected_order: "Expected Order", won: "Won ✓", lost: "Lost ✗",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "#6366f1", technical_discussion: "#8b5cf6", sample: "#ec4899",
  quotation: "#f59e0b", follow_up: "#3b82f6", expected_order: "#10b981", won: "#16a34a", lost: "#6b7280",
};

interface Lead { id: string; name: string; company: string; phone: string; city: string; source: string; stage: Stage; expected_value: number; next_action_date: string; notes: string; created_at: string; }

interface Props { products: { id: string; name: string }[]; }

export function LeadBoard({ products }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function refresh() {
    setLoading(true);
    salesFeaturesApi.leads().then(setLeads).finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function moveStage(lead: Lead, direction: 1 | -1) {
    const idx = STAGES.indexOf(lead.stage);
    const next = STAGES[idx + direction];
    if (!next) return;
    setMovingId(lead.id);
    await salesFeaturesApi.setLeadStage(lead.id, next).finally(() => setMovingId(null));
    refresh();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); setExpandedDetail(null); return; }
    setExpandedId(id);
    salesFeaturesApi.leadDetail(id).then(setExpandedDetail).catch(() => {});
  }

  const grouped: Record<Stage, Lead[]> = {} as any;
  STAGES.forEach((s) => (grouped[s] = []));
  leads.forEach((l) => { if (grouped[l.stage]) grouped[l.stage].push(l); });

  if (loading) return <div className="admin-placeholder">Loading pipeline…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Lead Pipeline <span style={{ fontWeight: 400, fontSize: "0.875rem", color: "var(--color-text-2)" }}>({leads.length} total)</span></h2>
        <button className="admin-button" onClick={() => setShowForm(true)}>+ Add Lead</button>
      </div>

      {showForm && (
        <LeadForm products={products} onCreated={() => { setShowForm(false); refresh(); }} onCancel={() => setShowForm(false)} />
      )}

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", gap: "0.75rem", minWidth: "max-content", paddingBottom: "1rem" }}>
          {STAGES.map((stage) => (
            <div key={stage} style={{ width: "220px", flexShrink: 0 }}>
              <div style={{ padding: "0.5rem 0.75rem", borderRadius: "8px 8px 0 0", background: STAGE_COLORS[stage], color: "#fff", fontSize: "0.8rem", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                <span>{STAGE_LABELS[stage]}</span>
                <span style={{ opacity: 0.8 }}>{grouped[stage].length}</span>
              </div>
              <div style={{ background: "var(--color-surface-2)", borderRadius: "0 0 8px 8px", minHeight: "200px", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {grouped[stage].length === 0 && (
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-3)", textAlign: "center", padding: "1rem 0" }}>No leads</div>
                )}
                {grouped[stage].map((lead) => {
                  const isOverdue = lead.next_action_date && lead.next_action_date < today;
                  return (
                    <div key={lead.id} style={{ background: "var(--color-surface)", borderRadius: "6px", padding: "0.625rem", border: "1px solid var(--color-border)", cursor: "pointer" }} onClick={() => toggleExpand(lead.id)}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>{lead.name}</div>
                      {lead.company && <div style={{ fontSize: "0.75rem", color: "var(--color-text-2)" }}>{lead.company}</div>}
                      {lead.expected_value > 0 && <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: "0.25rem" }}>{formatRupees(lead.expected_value)}</div>}
                      {lead.next_action_date && (
                        <div style={{ fontSize: "0.7rem", marginTop: "0.25rem", color: isOverdue ? "#dc2626" : "var(--color-text-3)" }}>
                          {isOverdue ? "⚠ " : ""}Action: {lead.next_action_date}
                        </div>
                      )}
                      {expandedId === lead.id && expandedDetail && (
                        <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--color-border)", fontSize: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                          {lead.phone && <div>📞 {lead.phone}</div>}
                          {lead.city && <div>📍 {lead.city}</div>}
                          {lead.source && <div>Source: {lead.source}</div>}
                          {lead.notes && <div style={{ marginTop: "0.25rem", color: "var(--color-text-2)" }}>{lead.notes}</div>}
                          {expandedDetail.activities?.slice(0, 2).map((a: any) => (
                            <div key={a.id} style={{ marginTop: "0.25rem", color: "var(--color-text-3)" }}>• {a.activity_type}: {a.subject}</div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                        {STAGES.indexOf(stage) > 0 && stage !== "won" && stage !== "lost" && (
                          <button style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--color-border)", background: "transparent", cursor: "pointer", color: "var(--color-text-2)" }} disabled={movingId === lead.id} onClick={() => moveStage(lead, -1)}>← Back</button>
                        )}
                        {STAGES.indexOf(stage) < STAGES.length - 1 && stage !== "won" && stage !== "lost" && (
                          <button style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: "4px", border: "none", background: STAGE_COLORS[stage], color: "#fff", cursor: "pointer" }} disabled={movingId === lead.id} onClick={() => moveStage(lead, 1)}>
                            {movingId === lead.id ? "…" : "Next →"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadForm({ products, onCreated, onCancel }: { products: { id: string; name: string }[]; onCreated: () => void; onCancel: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [customSource, setCustomSource] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const finalSource = selectedSource === "Other" ? (customSource.trim() ? `Other: ${customSource.trim()}` : "Other") : selectedSource;
    const payload: Record<string, unknown> = { name: form.get("name"), company: form.get("company"), phone: form.get("phone"), email: form.get("email"), city: form.get("city"), source: finalSource, interestedProductId: form.get("interestedProductId"), expectedValue: Number(form.get("expectedValue") || 0), nextActionDate: form.get("nextActionDate"), notes: form.get("notes") };
    setSaving(true); setError("");
    try { await salesFeaturesApi.addLead(payload); onCreated(); }
    catch (err: any) { setError(err.message ?? "Failed to save lead"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "10px", padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>New Lead</h3>
      {error && <div className="admin-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <label style={{ gridColumn: "1/-1" }}><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Name *</span><input name="name" required placeholder="Contact person or company name" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Company</span><input name="company" placeholder="Company name" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Phone</span><input name="phone" type="tel" placeholder="+91…" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Email</span><input name="email" type="email" placeholder="email@example.com" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>City</span><input name="city" placeholder="City" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Source</span>
          <select name="source" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}>
            <option value="">Select source</option>
            {["Referral", "Exhibition", "Website", "Field enquiry", "Walk-in", "Cold call", "Other"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {selectedSource === "Other" && (
          <label style={{ gridColumn: "1/-1" }}>
            <span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Specify Source Details *</span>
            <input
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              required
              placeholder="Specify where enquiry came from (e.g. Instagram, Trade Fair, Print Ad)"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}
            />
          </label>
        )}
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Interested Product</span>
          <select name="interestedProductId" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Expected Value (₹)</span><input name="expectedValue" type="number" min="0" placeholder="0" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Next Action Date</span><input name="nextActionDate" type="date" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" }} /></label>
        <label style={{ gridColumn: "1/-1" }}><span style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Notes</span><textarea name="notes" rows={2} placeholder="Any notes…" style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit", resize: "vertical" }} /></label>
        <div style={{ gridColumn: "1/-1", display: "flex", gap: "0.5rem" }}>
          <button type="submit" className="admin-button" disabled={saving}>{saving ? "Saving…" : "Add Lead"}</button>
          <button type="button" className="admin-button" style={{ background: "transparent", border: "1px solid var(--color-border)" }} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
