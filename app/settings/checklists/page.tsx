import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChecklistMasterPage } from "@/src/components/checklist-master-page";
import { getSession } from "@/src/lib/auth";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Master Checklist"};

export default async function MasterChecklistRoute({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  const rawReturnTo = (await searchParams).returnTo;
  const requestedReturnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const returnTo = requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : "/settings";
  return <ChecklistMasterPage demo={Boolean(session.isDemo)} returnTo={returnTo} />;
}
