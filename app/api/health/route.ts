import { NextResponse } from "next/server";
import { query } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureLatestDatabaseSchema();
    await query("SELECT 1");

    const hasGoogleAuth = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_OWNER_EMAIL,
    );
    const hasUploadStorage = process.env.VERCEL
      ? Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
      : true;

    if (!hasGoogleAuth || !hasUploadStorage) {
      return NextResponse.json({ status: "not_ready" }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("BN Trip health check failed", error);
    return NextResponse.json({ status: "not_ready" }, { status: 503 });
  }
}
