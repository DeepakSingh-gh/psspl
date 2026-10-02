"use client";
import { RmShell } from "@/components/rm/rm-shell";
import { RmProductTrends } from "@/components/rm/rm-product-trends";

export default function RmProductsPage() {
  return <RmShell activeHref="/rm/products"><RmProductTrends /></RmShell>;
}
