import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const metadata:Metadata={title:"ตั้งค่า"};

export default async function SettingsPage(){
  const session=await getSession();if(!session)redirect("/");
  const storageAdmin=session.email.trim().toLowerCase()===(process.env.STORAGE_ADMIN_EMAIL||"sarayutkongpeng@gmail.com").trim().toLowerCase();
  return <BNTripApp authenticated demo={Boolean(session.isDemo)} storageAdmin={storageAdmin} page="settings"/>;
}
