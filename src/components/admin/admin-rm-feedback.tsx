"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminPage, AdminState } from "./admin-shell";
import { adminApi } from "@/lib/api";
import { useAdminData } from "@/lib/use-admin-data";
import { RmFeedbackReport } from "@/components/reports/rm-feedback-report";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function AdminRmFeedbackSnapshot({ id }: { id: string }) {
  const { data, loading, error, reload } = useAdminData(() => adminApi.rmFeedback(id), [id], `rm-feedback-${id}`);
  const report = data?.id === id ? data : null;
  return <AdminState loading={loading || (!report && !error)} error={error} onRetry={reload}>{report && <RmFeedbackReport data={report} />}</AdminState>;
}

export function AdminRmFeedback({ initialId = "" }: { initialId?: string }) {
  const { data, loading, error, reload } = useAdminData(() => adminApi.rmFeedbackCatalog(), [], "rm-feedback-catalog");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const items = data?.items ?? [];
  const initial = items.find(report => [report.id, report.rm.name, report.rm.sourceName, report.rm.rmCode].some(value => normalize(value) === normalize(initialId)));
  const selected = items.find(report => report.id === selectedId) ?? initial ?? (!initialId ? items[0] : undefined);
  const matches = items.filter(report => `${report.rm.name} ${report.rm.sourceName} ${report.rm.rmCode} ${report.rm.operatingFrom}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <AdminPage eyebrow="Supplied reports" title="RM sales feedback" description="Preloaded September 2026 PDF snapshots. Select an RM to retrieve the supplied report immediately without PDF processing or AI generation." actions={<Link className="admin-button ghost" href="/admin/team">Live team performance</Link>}>
    <AdminState loading={loading} error={error} onRetry={reload}>
      {data && <><section className="feedback-directory"><label className="admin-search"><span>Search supplied RMs</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="RM name, code or operating city" /></label><p>{items.length} supplied reports · As of 30 September 2026</p><div className="feedback-rm-list">{matches.map(report => <button type="button" className={`admin-button ${selected?.id === report.id ? "" : "ghost"}`} key={report.id} aria-pressed={selected?.id === report.id} onClick={() => setSelectedId(report.id)}>{report.rm.name}<small>{report.rm.rmCode} · {report.rm.operatingFrom}</small></button>)}</div>{!matches.length && <p role="status">No supplied report matches this search.</p>}</section>
        {selected ? <AdminRmFeedbackSnapshot key={selected.id} id={selected.id} /> : <p className="admin-placeholder">No supplied PDF snapshot maps to this RM. Select a report from the list above.</p>}
      </>}
    </AdminState>
  </AdminPage>;
}
