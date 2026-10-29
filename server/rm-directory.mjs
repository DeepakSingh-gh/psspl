/**
 * The supplied PSSPL workbooks spell the same RM differently across files
 * ("Ketan Bhatt" / "Ketan Bhat", "YP Sharma" / "Y P Sharma" / "Y.P. Sharma",
 * "Gowri Shankar" / "Gauri Shankar", "Sourav Ranjit" / "Sourabh Ranjit").
 * Reporting joins on the name, so the variants are grouped here into one
 * canonical RM. The grouping is returned to the admin UI so it stays auditable
 * instead of silently merging rows.
 */
import { db } from "./db.mjs";
import { feedbackCatalog } from "./rm-feedback.mjs";

/** Placeholder owners used in the customer master instead of a real person. */
const NON_PERSON_RM = new Set(["psspl", "pssplcustomer", "psspldealer", "purchaseparty", "export", "customer", "dealer"]);

export const normalizeName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function editDistance(a, b) {
  if (a === b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const carry = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = carry;
    }
  }
  return previous[b.length];
}

const stripSuffix = (s) => s.replace(/(field|rep|salesperson)$/, "");

/** Two workbook spellings of the same person differ by at most two characters. */
function isSamePerson(a, b) {
  if (a === b) return true;
  const sa = stripSuffix(a);
  const sb = stripSuffix(b);
  if (sa === sb && sa.length >= 4) return true;
  if (sa.length < 5 || sb.length < 5) return false;
  if (Math.abs(sa.length - sb.length) > 2) return false;
  return editDistance(sa, sb) <= 2;
}

export function isNonPersonRm(name) {
  return NON_PERSON_RM.has(normalizeName(name));
}

function collectNameSources() {
  const sources = [
    ["sales", "SELECT DISTINCT rm_name name FROM tally_rm_product_sales WHERE rm_name IS NOT NULL AND rm_name<>''"],
    ["targets", "SELECT DISTINCT rm_name name FROM tally_rm_targets WHERE rm_name IS NOT NULL AND rm_name<>''"],
    ["customers", "SELECT DISTINCT rm_name name FROM tally_customers WHERE rm_name IS NOT NULL AND rm_name<>''"],
    ["salespeople", "SELECT DISTINCT rm_name name FROM tally_salespeople WHERE rm_name IS NOT NULL AND rm_name<>''"],
    ["crm", "SELECT DISTINCT p.full_name name FROM salesperson_profiles p JOIN users u ON u.id=p.user_id WHERE u.active=1 AND u.role IN ('salesperson','rm') AND p.full_name IS NOT NULL AND p.full_name<>''"],
  ];
  const seen = new Map();
  for (const [source, sql] of sources) {
    for (const row of db.prepare(sql).all()) {
      const key = normalizeName(row.name);
      if (!key || isNonPersonRm(row.name)) continue;
      const entry = seen.get(key) ?? { name: row.name, key, sources: new Set(), spellings: new Set() };
      entry.sources.add(source);
      entry.spellings.add(row.name);
      seen.set(key, entry);
    }
  }
  for (const report of feedbackCatalog) {
    const name = report.rm.name;
    const key = normalizeName(name);
    const entry = seen.get(key) ?? { name, key, sources: new Set(), spellings: new Set() };
    entry.sources.add("feedback");
    entry.spellings.add(name);
    seen.set(key, entry);
  }
  return [...seen.values()];
}

/**
 * Groups every spelling found in the workbooks into canonical RMs.
 * Canonical display name prefers the spelling used by the sales ledger, then
 * targets, then the longest variant.
 */
export function buildRmDirectory({ includeArchived = true } = {}) {
  const variants = collectNameSources();
  const groups = [];

  for (const variant of variants) {
    const match = groups.find((group) => group.variants.some((item) => isSamePerson(item.key, variant.key)));
    if (match) match.variants.push(variant);
    else groups.push({ variants: [variant] });
  }

  const archivedNames = new Set();
  const activeNames = new Set();
  if (!includeArchived) {
    for (const row of db.prepare("SELECT p.full_name,u.deleted_at FROM users u JOIN salesperson_profiles p ON p.user_id=u.id WHERE u.role='rm'").all()) {
      (row.deleted_at ? archivedNames : activeNames).add(normalizeName(row.full_name));
    }
  }
  return groups
    .map((group) => {
      const preferred =
        group.variants.find((item) => item.sources.has("sales")) ??
        group.variants.find((item) => item.sources.has("targets")) ??
        [...group.variants].sort((a, b) => b.name.length - a.name.length)[0];
      return {
        id: preferred.key,
        name: preferred.name,
        keys: group.variants.map((item) => item.key),
        aliases: [...new Set(group.variants.flatMap((item) => [...item.spellings]))].filter((name) => name !== preferred.name),
        sources: [...new Set(group.variants.flatMap((item) => [...item.sources]))].sort(),
      };
    })
    .filter(rm => includeArchived || !rm.keys.some(key => archivedNames.has(key)) || rm.keys.some(key => activeNames.has(key)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolves any workbook spelling to its canonical RM id, or null. */
export function resolveRmId(directory, name) {
  const key = normalizeName(name);
  if (!key) return null;
  return directory.find((rm) => rm.keys.includes(key))?.id ?? null;
}
