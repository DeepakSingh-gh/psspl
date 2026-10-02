"use client";
import { RmShell } from "@/components/rm/rm-shell";
import { RmCustomers } from "@/components/rm/rm-customers";

export default function RmCustomersPage() {
  return <RmShell activeHref="/rm/customers"><RmCustomers /></RmShell>;
}
