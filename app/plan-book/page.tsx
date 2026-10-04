import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { loadPlanBook } from "@/src/lib/plan-book";
import { PlanBook } from "@/src/components/plan-book";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมุดแพลน · ทุกการเดินทางในเล่มเดียว" };

export default async function PlanBookPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <PlanBook trips={await loadPlanBook(session)} />;
}
