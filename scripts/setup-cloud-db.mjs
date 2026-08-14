import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const ownerEmail = (process.env.GOOGLE_OWNER_EMAIL || "sarayutkongpeng@gmail.com").trim().toLowerCase();
const displayName = process.env.INITIAL_DISPLAY_NAME?.trim() || "Sarayut Kongpeng";

if (!databaseUrl) throw new Error("DATABASE_URL is required");

const initSql = await readFile(resolve("db/init.sql"), "utf8");
const schemaSql = initSql.split("-- LOCAL_DEMO_SEED:")[0];
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(schemaSql);
  await client.query(
    `INSERT INTO users (email, display_name)
     VALUES ($1, $2)
     ON CONFLICT ((lower(email))) WHERE email IS NOT NULL DO UPDATE
       SET display_name = EXCLUDED.display_name,
           updated_at = now()`,
    [ownerEmail, displayName],
  );
  await client.query("COMMIT");
  console.log(`Cloud database is ready for Google owner: ${ownerEmail}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
