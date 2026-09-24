import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "เข็มกลัดท่องเที่ยว",
  description: "สะสมเข็มกลัดและปักหมุดสถานที่ที่เคยเดินทางไปกับ RouteRao",
};

export default async function BadgesPage() {
  const session = await getSession();
  if (!session) redirect("/");
  redirect("/analytics#travel-badges");
}
