import { formatDate } from "@/lib/format";

type Coverage = { asOf?: string; entries?: Array<{ name: string; citiesCovered: string }> };

export function ExecutiveTerritoryCoverage({ coverage, compact = false }: { coverage?: Coverage; compact?: boolean }) {
  const grouped = new Map<string, string[]>();
  for (const entry of coverage?.entries ?? []) {
    if (!entry.name?.trim() || !entry.citiesCovered?.trim()) continue;
    const cities = grouped.get(entry.name.trim()) ?? [];
    if (!cities.includes(entry.citiesCovered.trim())) cities.push(entry.citiesCovered.trim());
    grouped.set(entry.name.trim(), cities);
  }
  return <section aria-label="Executive Territory Coverage" style={{ borderTop: "1px solid #e2e8f0", paddingTop: compact ? 6 : 10, color: "#334155" }}>
    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 5 }}>
      <strong style={{ fontSize: compact ? 10 : 12 }}>Executive Territory Coverage</strong>
      {coverage?.asOf && <small style={{ fontSize: compact ? 8 : 10, color: "#64748b" }}>Supplied report as of {formatDate(coverage.asOf)}</small>}
    </div>
    {grouped.size ? <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compact ? 9 : 12, textAlign: "left" }}>
      <thead><tr style={{ background: "#f0f7fc", color: "#52677f" }}>
        <th style={{ padding: "4px 8px", width: "23%" }}>Executive</th><th style={{ padding: "4px 8px" }}>Territory / Cities</th>
      </tr></thead>
      <tbody>{Array.from(grouped, ([name, cities]) => <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
        <td style={{ padding: "4px 8px", fontWeight: 700, verticalAlign: "top" }}>{name}</td>
        <td style={{ padding: "4px 8px", overflowWrap: "anywhere" }}>{cities.join("; ")}</td>
      </tr>)}</tbody>
    </table> : <p style={{ margin: 0, fontSize: compact ? 9 : 12, color: "#64748b" }}>Executive-to-territory mapping unavailable</p>}
  </section>;
}
