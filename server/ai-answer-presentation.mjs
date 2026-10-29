const money = value => {
  if (value == null) return "Not available";
  const amount = Math.abs(value);
  const divisor = amount >= 10000000 ? 10000000 : amount >= 100000 ? 100000 : 1;
  return `${value < 0 ? "-" : ""}\u20b9${(amount / divisor).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${divisor === 10000000 ? " crore" : divisor === 100000 ? " lakh" : ""}`;
};
const number = value => Number(value ?? 0).toLocaleString("en-IN");
const date = value => value ? new Date(value.includes("T") ? value : `${value}T00:00:00+05:30`).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "Not recorded";
const normalized = value => ` ${String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/** Plain words and exact source figures; the provider never supplies business facts. */
export function presentAiAnswer(snapshot, selected, question) {
  const sections = [];
  const metrics = [];
  const missing = [];
  const add = (title, points) => sections.push({ title, points });
  const matches = (snapshot.rmPerformance ?? []).filter(row => normalized(question).includes(normalized(row.name)));
  const focused = selected.includes("rmPerformance") && matches.length === 1 ? matches[0] : null;
  const rows = focused ? [focused] : matches.length ? matches : snapshot.rmPerformance ?? [];
  const performancePoints = (name, performance) => {
    const { actual, target, achievementPercent } = performance;
    if (actual == null && target == null) return [`${name}: sales and target numbers are missing for these dates. This does not mean sales are zero.`];
    const points = [`${name}: sales ${money(actual)}; target ${money(target)}.`];
    if (achievementPercent != null) points.push(`${achievementPercent}% of target reached${actual != null && target != null ? actual < target ? `; ${money(target - actual)} more sales needed` : actual > target ? `; ${money(actual - target)} above target` : "; target reached" : ""}.`);
    else points.push("We need both sales and the matching target to check progress.");
    return points;
  };
  if (focused) {
    add("What the records show", performancePoints(focused.name, focused.performance));
    add("What to do next", [
      "Check that this RM's customers and sales are assigned to the right name, and confirm the target for these dates.",
      "Ask the RM about delayed orders and check the bill dates. These records alone do not explain why sales changed.",
    ]);
  } else {
    for (const section of selected) {
      const value = snapshot[section];
      if (section === "sales") {
        metrics.push({ label: snapshot.scope === "admin" ? "Total sales across the business" : "Sales in your team", value: money(value.salesValue) }, { label: "Sales bills", value: number(value.invoiceCount) });
      } else if (section === "rmPerformance") {
        const available = rows.filter(row => row.performance.actual != null || row.performance.target != null);
        for (const row of available.slice(0, 5)) add(row.name, performancePoints(row.name, row.performance));
        const unavailable = rows.filter(row => row.performance.actual == null && row.performance.target == null);
        if (unavailable.length) {
          add("Missing RM numbers", [`Sales and targets are missing for ${unavailable.length} RM${unavailable.length === 1 ? "" : "s"}. Check customer assignments and target dates before comparing the team.`]);
          missing.push(...unavailable.map(row => row.name));
        }
        if (available.length > 5) add("More RMs", [`${available.length - 5} more RMs have figures. Open Team performance to see the full list.`]);
      } else if (section === "pipeline") {
        add("Orders that may come in", value.length ? [
          ...value.map(row => `${row.stage === "won" ? "Marked as won" : row.stage === "lead" ? "New enquiries" : String(row.stage).replaceAll("_", " ")}: ${number(row.count)}; saved order value ${money(row.value)}.`),
          "These are saved order values, not billed sales. Check the amounts and expected dates with the team.",
        ] : ["No possible orders are recorded."]);
      } else if (section === "followUps") {
        add("Customer follow-ups", [`${number(value.pending)} pending, ${number(value.overdue)} late and ${number(value.dueToday)} due today.`, value.pending ? "Contact the customers who are due or late, then save the next call or visit date." : "No pending follow-ups are saved. Check that the team has recorded its next customer calls and visits."]);
      } else if (section === "visits") {
        add("Customer visits", [`${number(value.completedInPeriod)} visits completed during these dates; ${number(value.upcomingToday)} more planned for today.`, value.pastScheduled ? `${number(value.pastScheduled)} earlier planned visits need a status update. Ask the team whether they happened or need a new date.` : "No earlier planned visits need a status update."]);
      } else if (section === "topProducts") {
        add("Top-selling products", value.length ? [...value.map(row => `${row.name}: ${money(row.salesValue)}.`), "These are the top five by sales, not the approved thrust product list."] : ["Product sales details are not available."]);
      } else if (section === "performance") add("Sales against target", performancePoints("Selected dates", value));
    }
  }
  const days = snapshot.data.ageHours == null ? null : Math.round(snapshot.data.ageHours / 24);
  const update = snapshot.data.lastCompletedAt ? `Last data update: ${date(snapshot.data.lastCompletedAt)}${days > 0 ? ` (about ${days} day${days === 1 ? "" : "s"} ago)` : ""}.` : "The last data update could not be confirmed.";
  const presentation = {
    title: focused ? `${focused.name}: sales check` : "Your sales and activity summary",
    summary: focused ? "Here is what we can check for this RM. Missing numbers need to be confirmed before explaining the result." : selected.length ? "Here are the main points from the available records." : "The available records cannot answer this question. Try asking about sales, products, customer visits or follow-ups.",
    period: `${date(snapshot.period.from)} to ${date(snapshot.period.to)}`,
    metrics, sections, missing,
    update,
    note: `${snapshot.data.status !== "current" ? "Check for a newer data update before acting. " : ""}${focused ? "Based on Tally sales records for these dates." : "Sales use Tally bills for these dates. Orders, visits and follow-ups show the latest saved status."}`,
  };
  const answer = [presentation.title, presentation.period, presentation.summary, ...metrics.map(item => `${item.label}: ${item.value}`), ...sections.map(item => `${item.title}\n${item.points.map(point => `- ${point}`).join("\n")}`), ...(missing.length ? [`RMs with missing numbers: ${missing.join(", ")}.`] : []), update, presentation.note].join("\n\n");
  return { answer, presentation };
}
