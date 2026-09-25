import type { Metadata } from "next";
import { getSession } from "@/src/lib/auth";
import { loadDashboard } from "@/src/lib/trip-loaders";
import type { DashboardPayload } from "@/src/lib/trip-loaders";
import type { DashboardCounts, Trip } from "@/src/components/bn-trip-app";
import { LoginScreen } from "@/src/components/login-screen";
import { AuthenticatedDashboard } from "@/src/components/authenticated-dashboard";
import { loadTripIdea } from "@/src/lib/trip-ideas";

export const metadata: Metadata = {
  title: "RouteRao — วางแผนทุกโมเมนต์ด้วยกัน",
  description: "สมุดท่องเที่ยวสีสดสำหรับแพลนทริป บันทึกความทรงจำ และคุมค่าใช้จ่าย",
};

export const dynamic = "force-dynamic";

export default async function Home({searchParams}:{searchParams:Promise<{authError?:string|string[];tripIdea?:string|string[]}>}) {
  const session = await getSession();
  const params=await searchParams;const raw=params.authError;const authError=typeof raw==="string"?raw:undefined;
  if(!session)return <LoginScreen authError={authError}/>;
  const ideaId=typeof params.tripIdea==="string"?params.tripIdea:"";
  const [initialDashboard,idea]=await Promise.all([
    loadDashboard(session) as Promise<DashboardPayload & {ongoing:Trip[];upcoming:Trip[];past:Trip[];counts:DashboardCounts}>,
    ideaId?loadTripIdea(session,ideaId):Promise.resolve(null),
  ]);
  const initialTripPreset=idea?.kind==="planned"&&idea.target_year&&idea.target_month?{
    sourceIdeaId:idea.id,
    destination:idea.name,
    note:idea.note,
    countryCode:idea.country_code||undefined,
    locationIds:idea.trip_destinations.map(destination=>destination.id),
    tripDestinations:idea.trip_destinations.map(destination=>({...destination,searchTerms:[destination.nameTh,destination.nameEn].filter(Boolean)})),
    coverImageUrl:idea.cover_image_url,
    outboundDate:`${idea.target_year}-${String(idea.target_month).padStart(2,"0")}-01`,
    outboundTime:"09:00",
  }:null;
  return <AuthenticatedDashboard demo={Boolean(session.isDemo)} initialDashboard={initialDashboard} initialTripPreset={initialTripPreset} />;
}
