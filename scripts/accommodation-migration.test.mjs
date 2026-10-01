import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import { Pool } from "pg";

// Replay the additive migration against isolated temporary tables, never production.
const source = readFileSync("src/lib/database-migrations.ts", "utf8");
const section = source.slice(source.indexOf("version: 49,"));
const statements = vm.runInNewContext(section.slice(section.indexOf("statements: [") + 12, section.indexOf("\n    ],") + 6));
const db = new Pool({ connectionString: "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" });
const client = await db.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE TEMP TABLE trip_accommodations (trip_id uuid, cost_item_id uuid) ON COMMIT DROP");
  await client.query("CREATE TEMP TABLE itineraries (trip_id uuid, cost_items jsonb) ON COMMIT DROP");
  const trip = randomUUID(), cost = randomUUID(), payer = randomUUID(), guest = randomUUID();
  await client.query("INSERT INTO trip_accommodations VALUES ($1,$2)", [trip,cost]);
  await client.query("INSERT INTO itineraries VALUES ($1,$2)", [trip,JSON.stringify([{ id:cost, paidBy:{type:"member",id:payer}, splitGuestIds:[guest] }])]);
  for (let run=0; run<2; run++) for (const sql of statements) await client.query(sql);
  const row = (await client.query("SELECT * FROM trip_accommodations")).rows[0];
  assert.equal(row.booking_url,"");
  assert.deepEqual(row.paid_by,{type:"member",id:payer});
  assert.deepEqual(row.split_guest_ids,[guest]);
  console.log("PASS: migration backfills legacy payer/guests, preserves blank link and is repeatable");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await db.end();
}
