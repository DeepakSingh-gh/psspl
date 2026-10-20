import type { TeamMember } from "@/types/admin";

/** Sort only comparable target-achievement scores; keep unavailable scores grouped last. */
export function rankRmPerformance(members: TeamMember[], order: "asc" | "desc" = "asc"): TeamMember[] {
  return [...members].sort((a, b) => {
    if (a.achievementPercent === null && b.achievementPercent !== null) return 1;
    if (a.achievementPercent !== null && b.achievementPercent === null) return -1;
    if (a.achievementPercent === null || b.achievementPercent === null) return a.name.localeCompare(b.name);
    return order === "asc" ? a.achievementPercent - b.achievementPercent : b.achievementPercent - a.achievementPercent;
  });
}
