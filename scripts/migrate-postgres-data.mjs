import pg from "pg";

const { Pool } = pg;
const sourceUrl = process.env.SOURCE_DATABASE_URL ?? (
  process.env.POSTGRES_PASSWORD
    ? `postgresql://bntrip:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@localhost:5434/bntrip`
    : undefined
);
const targetUrl = process.env.DATABASE_URL;

if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL is required");
if (!targetUrl) throw new Error("DATABASE_URL is required");
if (process.env.ALLOW_TARGET_REPLACE !== "yes") {
  throw new Error("Set ALLOW_TARGET_REPLACE=yes to replace all target application data");
}

const tables = [
  "users",
  "trips",
  "trip_collaborators",
  "collaborator_contacts",
  "itineraries",
  "credit_cards",
  "expenses",
  "flights",
  "lounges",
];
const jsonColumns = new Set(["cost_items"]);

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const source = new Pool({ connectionString: sourceUrl, max: 1 });
const target = new Pool({ connectionString: targetUrl, max: 1 });
const targetClient = await target.connect();

async function columnsFor(pool, table) {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

try {
  await targetClient.query("BEGIN");
  await targetClient.query(
    `TRUNCATE TABLE ${tables.map(quoteIdentifier).join(", ")} CASCADE`,
  );

  for (const table of tables) {
    const [sourceColumns, targetColumns] = await Promise.all([
      columnsFor(source, table),
      columnsFor(targetClient, table),
    ]);
    const targetColumnSet = new Set(targetColumns);
    const columns = sourceColumns.filter((column) => targetColumnSet.has(column));
    const selected = columns.map(quoteIdentifier).join(", ");
    const rows = await source.query(
      `SELECT ${selected} FROM ${quoteIdentifier(table)}`,
    );

    for (const row of rows.rows) {
      const values = columns.map((column) => {
        const value = row[column];
        return jsonColumns.has(column) && typeof value !== "string"
          ? JSON.stringify(value)
          : value;
      });
      const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
      await targetClient.query(
        `INSERT INTO ${quoteIdentifier(table)} (${selected}) VALUES (${placeholders})`,
        values,
      );
    }

    console.log(`${table}: ${rows.rowCount ?? rows.rows.length} rows`);
  }

  await targetClient.query("COMMIT");
  console.log("PostgreSQL application data migration completed");
} catch (error) {
  await targetClient.query("ROLLBACK");
  throw error;
} finally {
  targetClient.release();
  await Promise.all([source.end(), target.end()]);
}
