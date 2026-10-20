import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { attendanceRevision } from "../server/attendance-revision.mjs";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/attendance-monitor.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createAttendanceMonitor } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness(fetcher) {
  let now = 0, serial = 0, visible = true, resume;
  const timers = new Map();
  const subscribe = createAttendanceMonitor(fetcher, {
    visible: () => visible,
    schedule: (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; },
    cancel: id => timers.delete(id),
    onResume: fn => { resume = fn; return () => { resume = undefined; }; },
  });
  return {
    subscribe, timers,
    setVisible: value => { visible = value; },
    resume: () => resume?.(),
    async advance(ms) {
      now += ms;
      for (const [id, task] of [...timers]) if (task.at <= now && timers.has(id)) { timers.delete(id); task.fn(); }
      await settle();
    },
  };
}

test("persisted attendance revision detects check-in, check-out, aliases, edits and deletion", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE attendance(user_id TEXT,business_date TEXT,check_in_at TEXT,check_out_at TEXT)");
    const date = "2026-10-16";
    const empty = attendanceRevision(db, date);
    assert.equal(attendanceRevision(db, date), empty);
    db.prepare("INSERT INTO attendance VALUES (?,?,?,NULL)").run("field", date, "2026-10-16T09:00:00Z");
    const checkedIn = attendanceRevision(db, date);
    assert.notEqual(checkedIn, empty);
    db.prepare("UPDATE attendance SET check_out_at=? WHERE user_id=?").run("2026-10-16T10:00:00Z", "field");
    const checkedOut = attendanceRevision(db, date);
    assert.notEqual(checkedOut, checkedIn);
    db.prepare("INSERT INTO attendance VALUES (?,?,?,NULL)").run("rm-alias", date, "2026-10-16T09:30:00Z");
    const alias = attendanceRevision(db, date);
    assert.notEqual(alias, checkedOut);
    db.exec("UPDATE attendance SET check_in_at='2026-10-16T08:00:00Z' WHERE user_id='field'");
    const edited = attendanceRevision(db, date);
    assert.notEqual(edited, alias);
    db.exec("DELETE FROM attendance WHERE user_id='rm-alias'");
    assert.notEqual(attendanceRevision(db, date), edited);
    assert.notEqual(attendanceRevision(db, "2026-10-17"), empty);
  } finally { db.close(); }
});

test("multiple views share one poll and only refresh when the revision changes", async () => {
  let revision = "a", requests = 0, first = 0, second = 0;
  const h = harness(async () => { requests++; return { revision }; });
  const stop1 = h.subscribe(() => first++);
  const stop2 = h.subscribe(() => second++);
  await settle();
  assert.equal(requests, 1);
  await h.advance(2000);
  assert.equal(requests, 2);
  assert.equal(first, 0);
  revision = "b";
  await h.advance(2000);
  assert.equal(first, 1);
  assert.equal(second, 1);
  stop1(); stop2();
  assert.equal(h.timers.size, 0);
});

test("hidden tabs skip network and resuming immediately checks for changes", async () => {
  let requests = 0;
  const h = harness(async () => { requests++; return { revision: String(requests) }; });
  const stop = h.subscribe(() => {});
  await settle();
  h.setVisible(false);
  await h.advance(2000);
  assert.equal(requests, 1);
  h.setVisible(true); h.resume();
  await settle();
  assert.equal(requests, 2);
  stop();
});

test("requests do not overlap and pending results are ignored after unsubscribe", async () => {
  let requests = 0, resolve, signal;
  const h = harness(s => { requests++; signal = s; return new Promise(r => { resolve = r; }); });
  const stop = h.subscribe(() => assert.fail("Late result notified an unmounted view"));
  h.resume(); h.resume();
  await h.advance(2000);
  assert.equal(requests, 1);
  stop();
  assert.ok(signal.aborted);
  resolve({ revision: "late" });
  await settle();
  assert.equal(h.timers.size, 0);
});

test("temporary errors retain the baseline and retry detects the next change", async () => {
  let requests = 0, changes = 0;
  const h = harness(async () => {
    requests++;
    if (requests === 2) throw new Error("temporary outage");
    return { revision: requests === 1 ? "before" : "after" };
  });
  const stop = h.subscribe(() => changes++);
  await settle(); await h.advance(2000);
  assert.equal(changes, 0);
  await h.advance(2000);
  assert.equal(changes, 1);
  stop();
});
