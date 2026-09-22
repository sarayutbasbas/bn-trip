import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BNTripApp, type Trip } from "@/src/components/bn-trip-app";
import { getSession } from "@/src/lib/auth";
import { loadTripMemoryBook } from "@/src/lib/trip-loaders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมุดบันทึกการเดินทาง" };

export default async function AlbumPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const initialAlbumTrips = await loadTripMemoryBook(session) as Trip[];
  return (
    <BNTripApp
      authenticated
      demo={Boolean(session.isDemo)}
      page="album"
      initialAlbumTrips={initialAlbumTrips}
    />
  );
}
