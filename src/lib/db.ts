import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { bnTripPool?: Pool };

export const pool = globalForDb.bnTripPool ?? new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip",
  max: 10,
});

if (process.env.NODE_ENV !== "production") globalForDb.bnTripPool = pool;

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
