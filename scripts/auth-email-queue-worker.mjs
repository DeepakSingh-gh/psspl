// Test-only subprocess: processes a synthetic queue without network delivery.
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

globalThis.fetch = async (input) => {
  if (String(input) !== "https://api.resend.com/emails") throw new Error("Unexpected network request in email queue test");
  appendFileSync(process.env.CRM_TEST_SEND_LOG, "attempt\n");
  if (process.env.CRM_TEST_PROVIDER_FAILURE === "permanent")
    return Response.json({ name: "validation_error", message: "Synthetic permanent rejection" }, { status: 403 });
  if (process.env.CRM_TEST_PROVIDER_FAILURE === "true")
    return Response.json({ name: "internal_server_error", message: "Synthetic failure" }, { status: 503 });
  return Response.json({ id: process.env.CRM_TEST_EMAIL_ID || `synthetic-${randomUUID()}` });
};

const { processAuthEmailQueue } = await import("../server/auth-email-queue.mjs");
await processAuthEmailQueue();
const { db } = await import("../server/db.mjs");
db.close();
