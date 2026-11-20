import { createHash } from "node:crypto";

/** Fingerprint persisted attendance, including alias accounts and edits/deletes. */
export function attendanceRevision(database, date) {
  const rows = database.prepare("SELECT * FROM attendance WHERE business_date=? ORDER BY user_id").all(date);
  return createHash("sha256").update(JSON.stringify([date, rows])).digest("hex");
}
