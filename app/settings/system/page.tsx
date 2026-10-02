import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { isStorageAdmin } from "@/src/lib/storage-admin";
import { SystemOverviewPage } from "@/src/components/system-overview-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ภาพรวมระบบ", robots: { index: false, follow: false } };
export default async function SystemPage() {
  if (!isStorageAdmin(await getSession())) notFound();
  return <SystemOverviewPage />;
}
