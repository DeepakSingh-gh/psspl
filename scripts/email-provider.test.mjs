import test from "node:test";
import assert from "node:assert/strict";
import { emailProviderStatus, sendTransactionalEmail } from "../server/email-provider.mjs";

const settingNames = ["CRM_EMAIL_PROVIDER", "RESEND_API_KEY", "EMAIL_FROM", "CRM_EMAIL_FROM"];
const originalSettings = Object.fromEntries(settingNames.map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
test.after(() => {
  for (const [name, value] of Object.entries(originalSettings)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
});

test("Resend remains disabled unless explicitly selected and configured", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.CRM_EMAIL_FROM;
  process.env.CRM_EMAIL_PROVIDER = "disabled";
  assert.deepEqual(emailProviderStatus(), { configured: false, provider: "disabled" });
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("Network must not be used when disabled"); };
  assert.deepEqual(await sendTransactionalEmail({ to: "person@example.test", subject: "test", text: "test", html: "test" }), {
    accepted: false, status: "not_configured", reason: "email_not_configured",
  });
  assert.equal(calls, 0);
});

test("Resend SDK retries throttling with one idempotency key and accepts the provider email id", async () => {
  process.env.CRM_EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_synthetic_test_key";
  process.env.EMAIL_FROM = "PSSPL CRM <crm@example.test>";
  delete process.env.CRM_EMAIL_FROM;
  const requests = [];
  globalThis.fetch = async (_input, options) => {
    requests.push({ idempotencyKey: options.headers.get("Idempotency-Key"), body: JSON.parse(options.body) });
    return requests.length < 3
      ? Response.json({ name: "rate_limit_exceeded", statusCode: 429, message: "Synthetic throttling response" }, { status: 429 })
      : Response.json({ id: "synthetic-provider-email-id" });
  };
  const result = await sendTransactionalEmail({
    to: "person@example.test", subject: "Synthetic test", text: "No live delivery", html: "<p>No live delivery</p>",
    purpose: "reset", idempotencyKey: "synthetic-stable-key",
  });
  assert.deepEqual(result, { accepted: true, emailId: "synthetic-provider-email-id", status: "accepted" });
  assert.equal(requests.length, 3);
  assert.deepEqual(new Set(requests.map((request) => request.idempotencyKey)), new Set(["synthetic-stable-key"]));
  assert.equal(requests[0].body.from, "PSSPL CRM <crm@example.test>");
  assert.equal(requests[0].body.to, "person@example.test");
  assert.equal(requests[0].body.tags[0].value, "reset");
});
