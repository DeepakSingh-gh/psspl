"use client";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { rmReportPeriod, type RmReportSelection } from "../../../shared/rm-report-period.mjs";

export function RmPeriodFilters({ selection, onApply, rmId, ownRmId, managers, canSelectRm = false, loading = false, onPendingChange, formId }: {
  selection: RmReportSelection; onApply: (selection: RmReportSelection, rmId?: string, download?: boolean) => void;
  formId?: string;
  rmId?: string; ownRmId?: string; managers?: Array<{ id: string; name: string }>; canSelectRm?: boolean; loading?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [draft, setDraft] = useState(selection);
  const [draftRm, setDraftRm] = useState(rmId);
  useEffect(() => { setDraft(selection); setDraftRm(rmId); }, [selection, rmId]);
  const pending = JSON.stringify(draft) !== JSON.stringify(selection) || draftRm !== rmId;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const fourWeekSource = (canSelectRm ? draftRm : ownRmId) === "raiskhan" && draft.financialYear === "2026-27";
  const effectiveDraft = { ...draft, week: fourWeekSource ? Math.min(4, Number(draft.week ?? 1)) : draft.week, weekScheme: fourWeekSource ? "four" as const : "calendar" as const };
  const range = rmReportPeriod(effectiveDraft);
  const startYear = Number(draft.financialYear.slice(0, 4));
  const year = startYear + (Number(draft.month) < 4 ? 1 : 0);
  const weekCount = fourWeekSource ? 4 : Math.ceil(new Date(Date.UTC(year, Number(draft.month), 0)).getUTCDate() / 7);
  return <form id={formId} className="rm-period-filters" aria-label="Report filters" onSubmit={event => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    onApply(effectiveDraft, draftRm, submitter?.value === "download");
  }}>
    <header className="rm-period-filter-heading"><h2>RM Report Card</h2></header>
    {canSelectRm && <label className="rm-period-field">Select Regional Manager<select aria-label="Regional manager" value={draftRm} onChange={e => setDraftRm(e.target.value)}>{!managers?.some(rm => rm.id === draftRm) && <option value={draftRm}>Current RM</option>}{managers?.map(rm => <option key={rm.id} value={rm.id}>{rm.name}</option>)}</select></label>}
    <div className="rm-period-tabs" role="tablist" aria-label="Reporting frequency">
      {(["weekly", "monthly", "yearly"] as const).map(reportType => <button type="button" key={reportType} role="tab" aria-selected={draft.reportType === reportType} className={`rm-detail-period-btn${draft.reportType === reportType ? " active" : ""}`} onClick={() => setDraft({ ...draft, reportType })}>{reportType[0].toUpperCase() + reportType.slice(1)}</button>)}
    </div>
    <div className="rm-period-fields">

      <label>Financial Year<select aria-label="Financial year" value={draft.financialYear} onChange={e => setDraft({ ...draft, financialYear: e.target.value, week: 1 })}>{["2026-27", "2025-26", "2024-25"].map(fy => <option key={fy} value={fy}>FY {fy}</option>)}</select><small>April {startYear} – March {startYear + 1}</small></label>
      {draft.reportType !== "yearly" && <label>Select Month<select aria-label="Month" value={draft.month} onChange={e => setDraft({ ...draft, month: Number(e.target.value), week: 1 })}>{[4,5,6,7,8,9,10,11,12,1,2,3].map(month => <option key={month} value={month}>{new Date(Date.UTC(2024, month - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" })}</option>)}</select></label>}
      {draft.reportType === "weekly" && <label>Select Week<select aria-label="Week" value={effectiveDraft.week} onChange={e => setDraft({ ...draft, week: Number(e.target.value) })}>{Array.from({ length: weekCount }, (_, index) => { const dates = rmReportPeriod({ ...effectiveDraft, week: index + 1 }); return <option key={index} value={index + 1}>Week {index + 1}: {formatDate(dates.from)} – {formatDate(dates.to)}</option>; })}</select></label>}
    </div>
    <div className="rm-period-footer">
    <p className="rm-period-range" role="status">{formatDate(range.from)} – {formatDate(range.to)}{draft.reportType === "weekly" && <small> · Month-based reporting week</small>}</p>
    <button className="rm-period-view-button" type="submit" disabled={loading}>{loading ? "Loading report..." : "View Report"}</button>
    </div>
    {pending && <p className="rm-period-pending" role="status">Select View Report to apply these filters.</p>}
  </form>;
}
