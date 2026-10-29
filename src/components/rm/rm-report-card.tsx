"use client";
import { RmShell } from "./rm-shell";
import { AdminRmDetail } from "@/components/admin/admin-rm-detail";

export function RmReportCard() {
  return <RmShell activeHref="/rm/report-card"><AdminRmDetail rmId="self" audience="rm" /></RmShell>;
}
