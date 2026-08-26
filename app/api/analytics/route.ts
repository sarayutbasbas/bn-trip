import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { loadTravelAnalytics } from "@/src/lib/trip-loaders";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const analytics = await loadTravelAnalytics(session);
    return NextResponse.json(analytics, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { error: "รีเฟรชสถิติไม่สำเร็จ กรุณาลองอีกครั้ง" },
      { status: 500 },
    );
  }
}
