import type { UserRole } from "@/types/admin";

interface ReportingUser {
  id: string;
  role: UserRole;
  fullName: string | null;
  email: string;
  active: boolean;
  managerUserId: string | null;
}

/** Reporting follows account IDs, including inactive accounts, never name aliases. */
export function buildReportingStructure<T extends ReportingUser>(users: readonly T[]) {
  const byName = (a: T, b: T) => (a.fullName || a.email).localeCompare(b.fullName || b.email, "en", { sensitivity: "base" }) || a.email.localeCompare(b.email) || a.id.localeCompare(b.id);
  const admins = users.filter(user => user.role === "admin").sort(byName);
  const managers = users.filter(user => user.role === "rm").sort(byName);
  const salespeople = users.filter(user => user.role === "salesperson").sort(byName);
  const teams = new Map(managers.map(manager => [manager.id, [] as T[]]));
  const unassigned: T[] = [];
  for (const person of salespeople) {
    const team = person.managerUserId ? teams.get(person.managerUserId) : undefined;
    if (team) team.push(person);
    else unassigned.push(person);
  }
  return {
    admins,
    groups: managers.map(manager => ({ manager, members: teams.get(manager.id)! })),
    unassigned,
    totals: {
      admins: admins.length,
      rms: managers.length,
      activeRms: managers.filter(user => user.active).length,
      salespeople: salespeople.length,
      activeSalespeople: salespeople.filter(user => user.active).length,
      assigned: salespeople.length - unassigned.length,
      unassigned: unassigned.length,
    },
  };
}
