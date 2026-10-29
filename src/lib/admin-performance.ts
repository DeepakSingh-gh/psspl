import type { TeamMember } from "@/types/admin";

type PerformanceMember = Pick<TeamMember, "id" | "name" | "achievementPercent" | "salesValue">;

/** Rank known target achievement first; missing targets must not change everyone's metric. */
export function teamPerformanceMetric(members: Pick<TeamMember, "achievementPercent">[]): "achievement" | "sales" {
  return members.some((member) => typeof member.achievementPercent === "number" && Number.isFinite(member.achievementPercent))
    ? "achievement" : "sales";
}

export function rankRmPerformance<T extends PerformanceMember>(members: T[], order: "asc" | "desc" = "asc"): T[] {
  const metric = teamPerformanceMetric(members);
  const score = (member: T) => metric === "achievement" ? member.achievementPercent as number : member.salesValue;
  return [...members].sort((a, b) => {
    const left = score(a);
    const right = score(b);
    if (!Number.isFinite(left) && Number.isFinite(right)) return 1;
    if (Number.isFinite(left) && !Number.isFinite(right)) return -1;
    const difference = Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
    return (order === "asc" ? difference : -difference) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
