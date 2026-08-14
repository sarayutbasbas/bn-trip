import type { Metadata } from "next";
import { BNTripApp } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";

export const metadata: Metadata = {
  title: "BN Trip — วางแผนทุกโมเมนต์ด้วยกัน",
  description: "สมุดท่องเที่ยวสีสดสำหรับแพลนทริป บันทึกความทรงจำ และคุมค่าใช้จ่ายของเราสองคน",
};

export const dynamic = "force-dynamic";

export default async function Home({searchParams}:{searchParams:Promise<{authError?:string|string[]}>}) {
  const session = await getSession();
  const raw=(await searchParams).authError;const authError=typeof raw==="string"?raw:undefined;
  return <BNTripApp authenticated={Boolean(session)} demo={Boolean(session?.isDemo)} authError={authError} page="dashboard" />;
}
