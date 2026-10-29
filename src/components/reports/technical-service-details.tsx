type TechnicalService = { center?: string | null; executive?: string | null };

export function TechnicalServiceDetails({ service, compact = false }: { service?: TechnicalService; compact?: boolean }) {
  const entries = [
    ["Service center", service?.center?.trim()],
    ["Service executive", service?.executive?.trim()],
  ].filter(([, value]) => value);
  if (!entries.length) return null;

  return (
    <section aria-label="Technical service" style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: compact ? "8px 18px" : "12px 28px",
      padding: compact ? "8px 12px" : "12px 16px", borderRadius: 10,
      background: "#f0f7fc", border: "1px solid #dbeaf5", color: "#0f172a",
    }}>
      <span style={{ fontSize: compact ? 9 : 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#0369a1" }}>Technical Service</span>
      <dl style={{ display: "flex", flexWrap: "wrap", gap: compact ? "8px 22px" : "12px 32px", margin: 0 }}>
        {entries.map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
            <dt style={{ fontSize: compact ? 9 : 12, color: "#52677f" }}>{label}</dt>
            <dd style={{ margin: 0, fontSize: compact ? 10 : 13, fontWeight: 700 }}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
