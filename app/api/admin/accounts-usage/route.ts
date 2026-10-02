import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { isStorageAdmin } from "@/src/lib/storage-admin";
import { transaction } from "@/src/lib/db";
import { ACCOUNT_STORAGE_SQL, ACCOUNT_FILES_SQL } from "@/src/lib/account-storage-query";
import { accountStorageReport, type AccountStorageRow } from "@/src/lib/account-storage";
import { storageInventory } from "@/src/lib/storage-inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!isStorageAdmin(await getSession())) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  try {
    const [{ accounts, references }, inventory] = await Promise.all([
      transaction(async client => {
        await client.query("SET TRANSACTION READ ONLY");
        await client.query("SET LOCAL statement_timeout = '8s'");
        const accounts = await client.query<Omit<AccountStorageRow, "fileBytes" | "fileCount" | "missingFileCount">>(ACCOUNT_STORAGE_SQL);
        const references = await client.query<{ ownerId: string; url: string | null }>(ACCOUNT_FILES_SQL);
        return { accounts, references };
      }),
      storageInventory(),
    ]);
    return NextResponse.json(accountStorageReport(accounts.rows, references.rows, inventory), { headers });
  } catch (error) {
    console.error("[accounts-usage] request failed", error);
    return NextResponse.json({ error: "โหลดภาพรวมบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500, headers });
  }
}
