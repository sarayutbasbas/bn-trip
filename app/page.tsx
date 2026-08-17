import type { Metadata } from "next";
import { getSession } from "@/src/lib/auth";
import { loadDashboard } from "@/src/lib/trip-loaders";
import type { DashboardCounts, Trip } from "@/src/components/bn-trip-app";
import { LoginScreen } from "@/src/components/login-screen";
import { AuthenticatedDashboard } from "@/src/components/authenticated-dashboard";

export const metadata: Metadata = {
  title: "Pack & Go+ — วางแผนทุกโมเมนต์ด้วยกัน",
  description: "สมุดท่องเที่ยวสีสดสำหรับแพลนทริป บันทึกความทรงจำ และคุมค่าใช้จ่ายของเราสองคน",
};

export const dynamic = "force-dynamic";

export default async function Home({searchParams}:{searchParams:Promise<{authError?:string|string[]}>}) {
  const session = await getSession();
  const raw=(await searchParams).authError;const authError=typeof raw==="string"?raw:undefined;
  if(!session)return <LoginScreen authError={authError}/>;
  const initialDashboard=await loadDashboard(session) as {ongoing:Trip[];upcoming:Trip[];past:Trip[];counts:DashboardCounts};
  return <AuthenticatedDashboard demo={Boolean(session.isDemo)} initialDashboard={initialDashboard} />;
}
