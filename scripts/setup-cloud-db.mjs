import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const sharedId = process.env.INITIAL_SHARED_ID?.trim();
const displayName = process.env.INITIAL_DISPLAY_NAME?.trim() || sharedId;
const password = process.env.INITIAL_PASSWORD;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!sharedId || sharedId.length < 3 || sharedId.length > 60) {
  throw new Error("INITIAL_SHARED_ID must contain 3-60 characters");
}
if (!password || password.length < 10) {
  throw new Error("INITIAL_PASSWORD must contain at least 10 characters");
}

const initSql = await readFile(resolve("db/init.sql"), "utf8");
const schemaSql = initSql.split("-- LOCAL_DEMO_SEED:")[0];
const passwordHash = await bcrypt.hash(password, 12);
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(schemaSql);
  await client.query(
    `INSERT INTO users (shared_id, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (shared_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           password_hash = EXCLUDED.password_hash,
           updated_at = now()`,
    [sharedId, displayName, passwordHash],
  );
  await client.query("COMMIT");
  console.log(`Cloud database is ready for Shared Trip ID: ${sharedId}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
