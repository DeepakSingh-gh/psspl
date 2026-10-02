"use client";
import { RmShell } from "@/components/rm/rm-shell";
import { RmAlerts } from "@/components/rm/rm-alerts";

export default function RmAlertsPage() {
  return <RmShell activeHref="/rm/alerts"><RmAlerts /></RmShell>;
}
