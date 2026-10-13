"use client";
import { FormEvent, useEffect, useState } from "react";
import { salesFeaturesApi } from "@/lib/api";
import { formatRupees } from "@/lib/format";

const STAGES = ["lead", "technical_discussion", "sample", "quotation", "follow_up", "expected_order", "won", "lost"] as const;
type Stage = typeof STAGES[number];

const STAGE_LABELS: Record<Stage, string> = {
  lead: "New Lead", technical_discussion: "Tech Discussion", sample: "Sample",
  quotation: "Quotation", follow_up: "Follow-up", expected_order: "Expected Order", won: "Won ✓", lost: "Lost ✗",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "linear-gradient(135deg, #007CBA, #005682)",
  technical_discussion: "linear-gradient(135deg, #0088cc, #006496)",
  sample: "linear-gradient(135deg, #7A00DF, #5a00a8)",
  quotation: "linear-gradient(135deg, #007CBA, #004d73)",
  follow_up: "linear-gradient(135deg, #0094e0, #007CBA)",
  expected_order: "linear-gradient(135deg, #5fb472, #479a59)",
  won: "linear-gradient(135deg, #7CC68D, #5fb472)",
  lost: "linear-gradient(135deg, #CC1818, #991212)",
};

interface Lead { id: string; name: string; company: string; phone: string; city: string; source: string; stage: Stage; expected_value: number; next_action_date: string; notes: string; created_at: string; }



export function LeadBoard() {  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleDelete(leadId: string, leadName: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete lead "${leadName}"?`)) return;
    setDeletingId(leadId);
    try {
      await salesFeaturesApi.deleteLead(leadId);
      setLeads((current) => current.filter((l) => l.id !== leadId));
      if (expandedId === leadId) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  }

  async function moveLeadToStage(id: string, stage: Stage) {
    setLeads(current => current.map(l => l.id === id ? { ...l, stage } : l));
    setMovingId(id);
    await salesFeaturesApi.setLeadStage(id, stage).finally(() => setMovingId(null));
    refresh(true);
  }

  function refresh(silent = false) {
    if (!silent) setLoading(true);
    salesFeaturesApi.leads().then(setLeads).finally(() => {
      if (!silent) setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, []);

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

  if (loading) return <div className="admin-placeholder" style={{ animation: "pulse 2s infinite" }}>Loading pipeline…</div>;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .kanban-col {
          transition: all 0.2s ease;
        }
        .kanban-col:hover {
          transform: translateY(-2px);
        }
        .kanban-card {
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .kanban-card:hover {
          box-shadow: 0 8px 16px rgba(0,0,0,0.08);
          transform: translateY(-2px);
          border-color: #cbd5e1 !important;
        }
        .add-lead-btn {
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          transition: all 0.2s ease;
        }
        .add-lead-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        }
        .premium-input {
          transition: all 0.2s ease;
        }
        .premium-input:focus {
          outline: none;
          border-color: #0ea5e9 !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2) !important;
        }
        .premium-form {
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Lead Pipeline</h2>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.9rem" }}>Manage and track your prospects ({leads.length} active leads)</p>
        </div>
        <button className="add-lead-btn" style={{ color: "#fff", border: "none", padding: "0.6rem 1.25rem", borderRadius: "8px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={() => setShowForm(!showForm)}>
          <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{showForm ? '×' : '+'}</span>
          {showForm ? 'Close Form' : 'Add Lead'}
        </button>
      </div>

      {showForm && (
        <div className="premium-form">
          <LeadForm  onCreated={() => { setShowForm(false); refresh(); }} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div style={{ overflowX: "auto", paddingBottom: "1.5rem", WebkitOverflowScrolling: "touch", margin: "0 -1rem", padding: "0 1rem" }}>
        <div style={{ display: "flex", gap: "1rem", minWidth: "max-content", padding: "0.25rem" }}>
          {STAGES.map((stage) => (
            <div key={stage} className="kanban-col" style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", transform: overStage === stage ? "scale(1.02)" : "scale(1)", transition: "transform 0.2s" }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overStage !== stage) setOverStage(stage); }}
              onDragLeave={() => setOverStage((current) => current === stage ? null : current)}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragging; setOverStage(null); setDragging(null); if (id) moveLeadToStage(id, stage as Stage); }}
            >
              <div style={{ padding: "0.75rem 1rem", borderRadius: "12px 12px 0 0", background: STAGE_COLORS[stage], color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase" }}>{STAGE_LABELS[stage]}</span>
                <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>{grouped[stage].length}</span>
              </div>
              <div style={{ background: "#f8fafc", borderRadius: "0 0 12px 12px", border: "1px solid #e2e8f0", borderTop: "none", minHeight: "300px", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {grouped[stage].length === 0 && (
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", padding: "2rem 0", fontStyle: "italic" }}>Drop leads here</div>
                )}
                {grouped[stage].map((lead) => {
                  const isOverdue = lead.next_action_date && lead.next_action_date < today;
                  return (
                    <div key={lead.id} className="kanban-card" draggable onDragStart={(e) => { setDragging(lead.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); }} onDragEnd={() => { setDragging(null); setOverStage(null); }} style={{ background: "#ffffff", borderRadius: "10px", padding: "1rem", border: "1px solid #e2e8f0", cursor: "grab", position: "relative", overflow: "hidden", opacity: dragging === lead.id ? 0.5 : 1 }} onClick={() => toggleExpand(lead.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", marginBottom: "0.25rem", flex: 1, wordBreak: "break-word" }}>{lead.name}</div>
                        <button
                          type="button"
                          title="Delete Lead"
                          disabled={deletingId === lead.id}
                          onClick={(e) => handleDelete(lead.id, lead.name, e)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                            lineHeight: 1,
                            transition: "all 0.15s ease",
                            opacity: deletingId === lead.id ? 0.5 : 1,
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = "#ef4444";
                            e.currentTarget.style.background = "#fee2e2";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = "#94a3b8";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          {deletingId === lead.id ? "…" : "🗑️"}
                        </button>
                      </div>
                      {lead.company && <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>🏢 {lead.company}</div>}
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500, marginTop: "0.25rem" }}>📍 {lead.city || "Location pending"}</div>
                      
                      {lead.expected_value > 0 && (
                        <div style={{ display: "inline-block", background: "#f0fdf4", color: "#16a34a", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, marginTop: "0.5rem" }}>
                          💰 {formatRupees(lead.expected_value)}
                        </div>
                      )}
                      
                      {lead.next_action_date && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", marginTop: "0.75rem", color: isOverdue ? "#ef4444" : "#64748b", fontWeight: isOverdue ? 600 : 500, padding: "4px 8px", background: isOverdue ? "#fef2f2" : "#f1f5f9", borderRadius: "6px" }}>
                          <span>{isOverdue ? "⚠️" : "📅"}</span> {lead.next_action_date}
                        </div>
                      )}
                      
                      {expandedId === lead.id && expandedDetail && (
                        <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px dashed #cbd5e1", fontSize: "0.8rem", animation: "slideDown 0.2s ease" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {lead.phone && <div style={{ color: "#475569" }}>📞 <strong>{lead.phone}</strong></div>}
                            {lead.city && <div style={{ color: "#475569" }}>📍 {lead.city}</div>}
                            {lead.source && <div style={{ color: "#475569" }}>🎯 {lead.source}</div>}
                          </div>
                          {lead.notes && (
                            <div style={{ marginTop: "0.75rem", background: "#f8fafc", padding: "0.5rem", borderRadius: "6px", color: "#475569", fontStyle: "italic" }}>
                              "{lead.notes}"
                            </div>
                          )}
                          {expandedDetail.activities?.length > 0 && (
                            <div style={{ marginTop: "0.75rem" }}>
                              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.25rem", fontSize: "0.75rem", textTransform: "uppercase" }}>Recent Activity</div>
                              {expandedDetail.activities.slice(0, 2).map((a: any) => (
                                <div key={a.id} style={{ color: "#64748b", fontSize: "0.75rem", paddingLeft: "8px", borderLeft: "2px solid #cbd5e1", marginBottom: "4px" }}>
                                  <span style={{ textTransform: "capitalize" }}>{a.activity_type}</span>: {a.subject}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }} onClick={(e) => e.stopPropagation()}>
                        {STAGES.indexOf(stage) > 0 && stage !== "won" && stage !== "lost" && (
                          <button style={{ flex: 1, fontSize: "0.75rem", padding: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", color: "#475569", fontWeight: 500, transition: "all 0.2s" }} disabled={movingId === lead.id} onClick={() => moveStage(lead, -1)} onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.background = "#fff"}>
                            Back
                          </button>
                        )}
                        {STAGES.indexOf(stage) < STAGES.length - 1 && stage !== "won" && stage !== "lost" && (
                          <button style={{ flex: 1, fontSize: "0.75rem", padding: "4px", borderRadius: "6px", border: "none", background: STAGE_COLORS[stage], color: "#fff", cursor: "pointer", fontWeight: 600, transition: "all 0.2s", opacity: movingId === lead.id ? 0.7 : 1 }} disabled={movingId === lead.id} onClick={() => moveStage(lead, 1)} onMouseOver={e => e.currentTarget.style.filter = "brightness(1.1)"} onMouseOut={e => e.currentTarget.style.filter = "none"}>
                            {movingId === lead.id ? "…" : "Next Stage"}
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

function LeadForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [customSource, setCustomSource] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const finalSource = selectedSource === "Other" ? (customSource.trim() ? `Other: ${customSource.trim()}` : "Other") : selectedSource;
    const payload: Record<string, unknown> = { name: form.get("name"), company: form.get("company"), phone: form.get("phone"), email: form.get("email"), city: form.get("city"), source: finalSource, expectedValue: Number(form.get("expectedValue") || 0), nextActionDate: form.get("nextActionDate"), notes: form.get("notes") };
    setSaving(true); setError("");
    try { await salesFeaturesApi.addLead(payload); onCreated(); }
    catch (err: any) { setError(err.message ?? "Failed to save lead"); }
    finally { setSaving(false); }
  }

  const inputStyle = {
    width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", 
    background: "#f8fafc", color: "#0f172a", boxSizing: "border-box", fontSize: "0.9rem",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)"
  } as const;

  const labelStyle = { fontSize: "0.85rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.4rem" };

  return (
    <div style={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: "16px", padding: "2rem", marginBottom: "2rem", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ display: "inline-flex", background: "#e0f2fe", color: "#0284c7", padding: "6px", borderRadius: "8px" }}>✨</span>
          Create New Lead
        </h3>
      </div>
      
      {error && <div style={{ background: "#fef2f2", color: "#ef4444", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.9rem", border: "1px solid #fca5a5" }}>{error}</div>}
      
      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
        <label style={{ gridColumn: "1 / -1", maxWidth: "100%" }}>
          <span style={labelStyle}>Contact Person Name <span style={{ color: "#ef4444" }}>*</span></span>
          <input className="premium-input" name="name" required placeholder="John Doe" style={inputStyle} />
        </label>
        
        <label><span style={labelStyle}>Company Name</span><input className="premium-input" name="company" placeholder="Acme Corp" style={inputStyle} /></label>
        <label><span style={labelStyle}>Phone Number</span><input className="premium-input" name="phone" type="tel" placeholder="+91 9876543210" style={inputStyle} /></label>
        <label><span style={labelStyle}>Email Address</span><input className="premium-input" name="email" type="email" placeholder="john@example.com" style={inputStyle} /></label>
        <label><span style={labelStyle}>City / Location</span><input className="premium-input" name="city" placeholder="Mumbai, MH" style={inputStyle} /></label>
        
        <label><span style={labelStyle}>Lead Source</span>
          <select className="premium-input" name="source" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} style={{...inputStyle, appearance: "none", backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem top 50%", backgroundSize: "0.65rem auto"}}>
            <option value="">Select source...</option>
            {["Referral", "Exhibition", "Website", "Field enquiry", "Walk-in", "Cold call", "Other"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        
        {selectedSource === "Other" && (
          <label style={{ gridColumn: "1/-1" }}>
            <span style={labelStyle}>Specify Source Details <span style={{ color: "#ef4444" }}>*</span></span>
            <input className="premium-input" value={customSource} onChange={(e) => setCustomSource(e.target.value)} required placeholder="e.g. Trade Fair, Print Ad, etc." style={inputStyle} />
          </label>
        )}
        
        
        
        <label><span style={labelStyle}>Expected Deal Value (₹)</span><input className="premium-input" name="expectedValue" type="number" min="0" placeholder="e.g. 50000" style={{...inputStyle, fontWeight: 600, color: "#16a34a"}} /></label>
        <label><span style={labelStyle}>Next Action Date</span><input className="premium-input" name="nextActionDate" type="date" style={inputStyle} /></label>
        
        <label style={{ gridColumn: "1/-1" }}><span style={labelStyle}>Additional Notes</span><textarea className="premium-input" name="notes" rows={3} placeholder="Add any background context, specific requirements, or conversation details..." style={{...inputStyle, resize: "vertical"}} /></label>
        
        <div style={{ gridColumn: "1/-1", display: "flex", gap: "1rem", marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem" }}>
          <button type="submit" className="add-lead-btn" style={{ flex: 1, padding: "0.75rem", borderRadius: "8px", background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "white", border: "none", fontWeight: 700, fontSize: "1rem", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }} disabled={saving}>
            {saving ? <span style={{ animation: "pulse 2s infinite" }}>Processing...</span> : <><span>✓</span> Create Lead Record</>}
          </button>
          <button type="button" style={{ padding: "0.75rem 1.5rem", borderRadius: "8px", background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1", fontWeight: 600, fontSize: "1rem", cursor: "pointer", transition: "all 0.2s" }} onClick={onCancel} onMouseOver={e => e.currentTarget.style.background = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.background = "#f8fafc"}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
