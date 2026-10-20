const EMAIL_EVENT_STATUS = new Map([
  ["email.sent", "sent"],
  ["email.delivered", "delivered"],
  ["email.delivery_delayed", "delivery_delayed"],
  ["email.bounced", "bounced"],
  ["email.complained", "complained"],
  ["email.failed", "failed"],
  ["email.suppressed", "suppressed"],
]);

export function recordResendEmailEvent(database, event) {
  const status = EMAIL_EVENT_STATUS.get(event?.type);
  const emailId = event?.data?.email_id;
  const eventAt = event?.created_at;
  if (!status || typeof emailId !== "string" || !emailId || typeof eventAt !== "string" || !Number.isFinite(Date.parse(eventAt))) return false;
  database.prepare(`UPDATE auth_email_delivery SET status=?,last_event_type=?,event_at=?,updated_at=?
    WHERE email_id=? AND (event_at IS NULL OR event_at<=?)`)
    .run(status, event.type, eventAt, new Date().toISOString(), emailId, eventAt);
  if (!database.prepare("SELECT 1 FROM auth_email_delivery WHERE email_id=?").get(emailId)) {
    database.prepare(`INSERT INTO auth_email_pending_events(email_id,status,event_type,event_at) VALUES(?,?,?,?)
      ON CONFLICT(email_id) DO UPDATE SET status=excluded.status,event_type=excluded.event_type,event_at=excluded.event_at
      WHERE excluded.event_at>=auth_email_pending_events.event_at`).run(emailId, status, event.type, eventAt);
  }
  return true;
}

export function reconcilePendingResendEvent(database, emailId) {
  const pending = database.prepare("SELECT status,event_type,event_at FROM auth_email_pending_events WHERE email_id=?").get(emailId);
  if (!pending) return;
  database.prepare(`UPDATE auth_email_delivery SET status=?,last_event_type=?,event_at=?,updated_at=? WHERE email_id=?`)
    .run(pending.status, pending.event_type, pending.event_at, new Date().toISOString(), emailId);
  database.prepare("DELETE FROM auth_email_pending_events WHERE email_id=?").run(emailId);
}
