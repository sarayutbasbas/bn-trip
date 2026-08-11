import type { Metadata } from "next";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const metadata: Metadata = {
  title: "BN Trip — วางแผนทุกโมเมนต์ด้วยกัน",
  description: "สมุดท่องเที่ยวสีสดสำหรับแพลนทริป บันทึกความทรงจำ และคุมค่าใช้จ่ายของเราสองคน",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  return <BNTripApp authenticated={Boolean(session)} page="dashboard" />;
}
