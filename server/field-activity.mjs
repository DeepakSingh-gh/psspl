import { randomUUID } from "node:crypto";
import { indiaBusinessDate } from "../shared/business-date.mjs";
export { indiaBusinessDate };

/** Return the calendar date in India without depending on the host timezone. */

/** Validate browser geolocation payloads before storing them as field evidence. */
export function validateLocation(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Location data is required" };
  const { latitude, longitude, accuracy } = payload;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: "Valid GPS coordinates are required" };
  }
  if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0)) {
    return { ok: false, error: "GPS accuracy must be a non-negative number of meters" };
  }
  return { ok: true, latitude, longitude, accuracy: accuracy ?? null };
}

export function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function recordDailyCheckIn(database, runTransaction, userId, businessDate, payload = {}) {
  if (database.prepare("SELECT 1 FROM attendance WHERE user_id=? AND business_date=?").get(userId, businessDate)) {
    return { ok: false, status: 409, error: "You are already checked in for today" };
  }
  const location = payload.latitude === undefined && payload.longitude === undefined ? null : validateLocation(payload);
  if (location && !location.ok) return { ok: false, status: 400, error: location.error };
  const checkedInAt = new Date().toISOString();
  runTransaction(() => {
    database.prepare("INSERT INTO attendance (id,user_id,business_date,check_in_at,latitude,longitude) VALUES (?,?,?,?,?,?)")
      .run(randomUUID(), userId, businessDate, checkedInAt, location?.latitude ?? null, location?.longitude ?? null);
    if (location) database.prepare("INSERT INTO location_pings (id,user_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?)")
      .run(randomUUID(), userId, location.latitude, location.longitude, location.accuracy);
  });
  return { ok: true, checkedInAt, gpsCaptured: Boolean(location), gpsAccuracyMeters: location?.accuracy ?? null };
}

/** Summarize saved field evidence for one employee and India business day. */
export function dailyFieldActivity(database, userId, businessDate) {
  const visits = database.prepare("SELECT status,COUNT(*) count FROM visits WHERE user_id=? AND business_date=? GROUP BY status").all(userId, businessDate);
  const visitCounts = Object.fromEntries(visits.map((row) => [row.status, row.count]));
  const calls = database.prepare("SELECT a.id,a.activity_type,a.subject,a.notes,a.occurred_at,c.name customer FROM customer_activities a LEFT JOIN tally_customers c ON c.id=a.tally_customer_id WHERE a.user_id=? AND a.activity_type IN ('call','call_incoming','call_outgoing') AND date(a.occurred_at,'+5 hours','+30 minutes')=? ORDER BY a.occurred_at DESC LIMIT 20").all(userId, businessDate)
    .map((row) => ({ id: row.id, direction: row.activity_type === "call_incoming" ? "incoming" : row.activity_type === "call_outgoing" ? "outgoing" : "unspecified", purpose: row.subject, notes: row.notes, occurredAt: row.occurred_at, customer: row.customer || "Customer" }));
  const pendingFollowUps = database.prepare("SELECT COUNT(*) count FROM follow_ups WHERE user_id=? AND completed=0").get(userId).count;
  const overdueActivities = database.prepare("SELECT COUNT(*) count FROM follow_ups WHERE user_id=? AND completed=0 AND due_date<?").get(userId, businessDate).count;
  const attendance = database.prepare("SELECT check_in_at,check_out_at FROM attendance WHERE user_id=? AND business_date=?").get(userId, businessDate);
  const expectedOrders = database.prepare("SELECT COALESCE(SUM(expected_value),0) value,COUNT(*) count FROM expected_orders WHERE user_id=? AND date(created_at,'+5 hours','+30 minutes')=?").get(userId, businessDate);
  const loggedCalls = database.prepare("SELECT COUNT(*) count FROM customer_activities WHERE user_id=? AND activity_type IN ('call','call_incoming','call_outgoing') AND date(occurred_at,'+5 hours','+30 minutes')=?").get(userId, businessDate).count;
  return {
    calls,
    summary: {
      plannedVisits: Object.values(visitCounts).reduce((sum, count) => sum + count, 0),
      completedVisits: visitCounts.completed || 0,
      pendingVisits: (visitCounts.planned || 0) + (visitCounts.in_progress || 0),
      loggedCalls,
      pendingFollowUps,
      overdueActivities,
      expectedOrderValueToday: expectedOrders.value,
      expectedOrderCountToday: expectedOrders.count,
      // follow_ups has no completion timestamp; do not mislabel historical completions as today's work.
      completedActivities: (visitCounts.completed || 0) + loggedCalls,
      attendanceStatus: attendance?.check_out_at ? "checked_out" : attendance?.check_in_at ? "checked_in" : "not_checked_in",
    },
  };
}

