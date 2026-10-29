import { readFileSync } from "node:fs";

// One startup read. Every request uses indexed, immutable data; no PDF parser,
// database aggregation, network request or AI call runs on the snapshot path.
const source = JSON.parse(readFileSync(new URL("./data/rm-feedback-snapshots.json", import.meta.url), "utf8"));
const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const reports = freeze(source.reports);
const byId = new Map(reports.map(report => [report.id, report]));
const byCode = new Map(reports.map(report => [report.rm.rmCode, report]));
const byName = new Map(reports.flatMap(report => [report.rm.name, report.rm.sourceName].map(name => [normalize(name), report])));
for (const [alias, id] of Object.entries({ "Gauri Shankar": "gowrishankar", "Sourabh Ranjit": "souravranjit", "Y P Sharma": "ypsharma", "Pradip Mulik": "pradeepmulik" })) byName.set(normalize(alias), byId.get(id));

export const feedbackCatalog = freeze(reports.map(({ id, reportDate, asOf, financialYear, rm, annual, source }) => ({ id, reportDate, asOf, financialYear, rm, annual, source })));
export const feedbackById = id => byId.get(normalize(id)) ?? null;
export function feedbackForIdentity({ name, rmCode } = {}) {
  const named = byName.get(normalize(name));
  const coded = byCode.get(String(rmCode ?? "").trim());
  if (named && coded && named !== coded) return null;
  return named ?? coded ?? null;
}
