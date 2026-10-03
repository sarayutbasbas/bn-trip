// Dry-run by default. --apply requires --backup-dir=/absolute/private/directory.
// Credentials are supplied by the environment; never saved in the manifest.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { list, get, del } from "@vercel/blob";
import { ACCOUNT_FILES_SQL } from "../src/lib/account-storage-query.ts";
import { fileStorageKey } from "../src/lib/account-storage.ts";

const apply = process.argv.includes("--apply");
const backup = process.argv.find(arg => arg.startsWith("--backup-dir="))?.slice(13);
const minAgeHours = Number(process.argv.find(arg => arg.startsWith("--min-age-hours="))?.slice(16) ?? 24);
if (!Number.isFinite(minAgeHours) || minAgeHours < 1) throw new Error("Minimum age must be at least one hour");
if (apply && (!backup || !path.isAbsolute(backup))) throw new Error("An absolute backup directory is required");
if (!process.env.DATABASE_URL || !process.env.BLOB_STORE_ID) throw new Error("Explicit database and Blob store required");
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
try {
  const inventory = [];
  let cursor;
  do {
    const page = await list({ limit: 1000, cursor });
    inventory.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const references = await db.query(ACCOUNT_FILES_SQL);
  const used = new Set(references.rows.map(row => fileStorageKey(row.url)));
  const unmatched = inventory.filter(blob => !used.has(blob.pathname));
  // Do not touch active uploads that have not yet been saved in a form.
  const candidates = unmatched.filter(blob => /^uploads\/(?:doc-)?[a-f0-9-]+\.(webp|jpg|png|pdf)$/.test(blob.pathname)
    && Date.now() - new Date(blob.uploadedAt).getTime() > minAgeHours * 60 * 60 * 1000);
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'trip_activity_logs'")).rows.map(row => row.tablename);
  if (tables.some(table => !/^[a-z_]+$/.test(table))) throw new Error("Unexpected table identifier");
  // Also protect references in notes/JSON fields that aren't counted by the dashboard.
  const liveReferenceSql = tables.map(table => `SELECT 1 FROM "${table}" r WHERE strpos(to_jsonb(r)::text,$1)>0`).join(" UNION ALL ");
  const safe = [];
  for (const blob of candidates) {
    const filename = path.basename(blob.pathname);
    const live = await db.query(`SELECT EXISTS(${liveReferenceSql}) AS used`, [filename]);
    if (!live.rows[0].used) safe.push(blob);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "audit", inventory: inventory.length, unmatched: unmatched.length,
    eligible: safe.length, protectedOrRecent: unmatched.length - safe.length, bytes: safe.reduce((sum,b) => sum+b.size,0) }));
  if (!apply) process.exitCode = 0;
  else {
    await mkdir(backup, { recursive: true, mode: 0o700 });
    const manifest = { createdAt: new Date().toISOString(), store: process.env.BLOB_STORE_ID, files: safe, deleted: [] };
    await writeFile(path.join(backup,"manifest.json"),JSON.stringify(manifest,null,2),{mode:0o600,flag:"wx"});
    // Finish all backups before deleting anything.
    for (const blob of safe) {
      const response = await get(blob.url,{access:"private"});
      if (!response || response.statusCode !== 200) throw new Error("Backup download failed");
      const data = Buffer.from(await new Response(response.stream).arrayBuffer());
      if (data.length !== blob.size) throw new Error("Backup size mismatch");
      await writeFile(path.join(backup,path.basename(blob.pathname)),data,{mode:0o600,flag:"wx"});
    }
    for (const blob of safe) {
      const live = await db.query(`SELECT EXISTS(${liveReferenceSql}) AS used`,[path.basename(blob.pathname)]);
      if (live.rows[0].used) continue;
      await del(blob.url);
      manifest.deleted.push(blob.pathname);
      await writeFile(path.join(backup,"manifest.json"),JSON.stringify(manifest,null,2),{mode:0o600});
    }
    console.log(JSON.stringify({ deleted: manifest.deleted.length, backup }));
  }
} finally { await db.end(); }
