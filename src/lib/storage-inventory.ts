import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { list } from "@vercel/blob";
import { getStorageBackend } from "./storage";
import type { StorageInventory } from "./account-storage";

// Short server-only cache avoids a complete Blob listing on every page refresh.
let cached: { expires: number; value: StorageInventory } | undefined;
let pending: Promise<StorageInventory> | undefined;
async function scan(): Promise<StorageInventory> {
  const backend = getStorageBackend();
  const result: StorageInventory = { backend, files: new Map(), available: false, complete: false };
  try {
    if (backend === "blob") {
      const abortSignal = AbortSignal.timeout(18000);
      let cursor: string | undefined;
      for (let page = 0; page < 100; page++) {
        const data = await list({ limit: 1000, cursor, abortSignal });
        for (const blob of data.blobs) result.files.set(blob.pathname, blob.size);
        result.available = true;
        if (!data.hasMore) { result.complete = true; break; }
        cursor = data.cursor;
        if (!cursor) break;
      }
    } else {
      const root = process.env.UPLOAD_DIR || "/tmp/bn-trip-uploads";
      const walk = async (directory: string, prefix: string) => {
        const entries = await readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
          const filename = path.join(directory, entry.name);
          const key = `${prefix}${entry.name}`;
          if (entry.isDirectory()) await walk(filename, `${key}/`);
          else if (entry.isFile()) result.files.set(key, (await stat(filename)).size);
        }
      };
      try { await walk(root, "uploads/"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      result.available = true; result.complete = true;
    }
  } catch { /* Partial/unavailable is explicitly surfaced, never reported as an empty store. */ }
  return result;
}
export async function storageInventory() {
  if (cached && cached.expires > Date.now()) return cached.value;
  if (!pending) pending = scan().then(value => {
    if (value.complete) cached = { value, expires: Date.now() + 30000 };
    return value;
  }).finally(() => { pending = undefined; });
  return pending;
}
