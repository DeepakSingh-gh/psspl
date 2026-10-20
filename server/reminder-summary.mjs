import { authorizedScope, reportSnapshot } from "./report-snapshot.mjs";
import { indiaBusinessDate } from "./field-activity.mjs";
import { classifyPlannedVisits } from "./rm-report-intelligence.mjs";

export function reminderSummary(db, userId, now = new Date()) {
  const { ids } = authorizedScope(db, userId), asOf = indiaBusinessDate(now), ph = ids.map(() => "?").join(",");
  const followUps = db.prepare(`SELECT COUNT(*) pending,COALESCE(SUM(CASE WHEN due_date<? THEN 1 ELSE 0 END),0) overdue,COALESCE(SUM(CASE WHEN due_date=? THEN 1 ELSE 0 END),0) dueToday FROM follow_ups WHERE completed=0 AND user_id IN (${ph})`).get(asOf, asOf, ...ids);
  const rows = db.prepare(`SELECT business_date businessDate,scheduled_at scheduledAt,status FROM visits WHERE user_id IN (${ph}) AND status<>'completed'`).all(...ids);
  const visits = classifyPlannedVisits(rows, { asOf, now: now.toISOString() });
  const managementAttention = reportSnapshot(db, userId, { from: `${asOf.slice(0, 7)}-01`, to: asOf }, now).rmPerformance.flatMap(r => r.attention);
  return { channel: "in-app", externalDelivery: false, asOf, followUps, managementAttention, visits: { upcoming: visits.filter(r => !r.pastScheduledTime).length, pastScheduled: visits.filter(r => r.pastScheduledTime).length }, reviewInstruction: "Confirm visit outcome with the owner; an outstanding visit does not prove a no-show." };
}
