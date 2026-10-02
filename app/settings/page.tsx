import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { isStorageAdmin } from "@/src/lib/storage-admin";

export const dynamic = "force-dynamic";
export const metadata:Metadata={title:"ตั้งค่า"};

export default async function SettingsPage(){
  const session=await getSession();if(!session)redirect("/");
  const storageAdmin=isStorageAdmin(session);
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} storageAdmin={storageAdmin} page="settings"/>;
}
