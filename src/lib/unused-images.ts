import { after } from "next/server";
import { query } from "@/src/lib/db";
import { ACCOUNT_FILES_SQL } from "@/src/lib/account-storage-query";
import { fileStorageKey } from "@/src/lib/account-storage";
import { deleteUpload, uploadFilenameFromUrl } from "@/src/lib/storage";

/** Only persisted, previous media is eligible. Never delete external/static assets. */
export function recordImages(record: Record<string, unknown> | undefined): string[] {
  if (!record) return [];
  return [record.image_url, record.cover_image_url, record.summary_image_url,
    ...(Array.isArray(record.cover_image_urls) ? record.cover_image_urls : [])]
    .filter((value): value is string => typeof value === "string");
}

export async function deleteUnusedImages(urls: string[]) {
  const filenames = [...new Set(urls.flatMap(url => {
    const filename = uploadFilenameFromUrl(url);
    return filename ? [filename] : [];
  }))];
  if (!filenames.length) return;
  // Includes every account, cover slot, linked accommodation, document and avatar.
  // An idea converted into a trip can still use the same file.
  const references = await query<{ url: string }>(ACCOUNT_FILES_SQL);
  const used = new Set(references.rows.map(row => fileStorageKey(row.url)));
  await Promise.all(filenames.filter(filename => !used.has(`uploads/${filename}`)).map(async filename => {
    await deleteUpload(filename);
  }));
}

/** Run after the successful response, without delaying save/navigation on Blob IO. */
export function scheduleUnusedImageCleanup(urls: string[], retained: string[] = []) {
  const candidates = urls.filter(url => !retained.includes(url));
  if (!candidates.length) return;
  after(async () => {
    try { await deleteUnusedImages(candidates); }
    catch (error) { console.error("Unused image cleanup failed", error); }
  });
}
