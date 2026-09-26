import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TripIdeasPage } from "@/src/components/trip-ideas-page";
import { getSession } from "@/src/lib/auth";
import { loadTripIdeas } from "@/src/lib/trip-ideas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ทริปที่เล็งไว้",
  description: "เก็บทริปในอนาคตและสถานที่ในฝันที่อยากไปสักวัน",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { edit } = await searchParams;
  return <TripIdeasPage initialIdeas={await loadTripIdeas(session)} initialEditId={edit} demo={Boolean(session.isDemo)} />;
}
