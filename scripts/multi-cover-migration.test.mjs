import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
const db=new Pool({connectionString:"postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip"});
const client=await db.connect();
try {
  await client.query("BEGIN");
  // Transaction-local tables shadow the real ones: no existing rows are touched.
  for(const table of ["trips","trip_ideas"]) {
    await client.query(`CREATE TEMP TABLE ${table} (cover_image_url TEXT) ON COMMIT DROP`);
    await client.query(`INSERT INTO ${table}(cover_image_url) VALUES('/legacy.jpg')`);
  }
  const source=readFileSync("src/lib/database-migrations.ts","utf8");
  const block=source.match(/version: 50,\s*statements: \[([\s\S]*?)\],/)[1];
  const statements=JSON.parse(`[${block.trim().replace(/,$/,"")}]`);
  for(const sql of statements)await client.query(sql);
  for(const table of ["trips","trip_ideas"]) {
    assert.deepEqual((await client.query(`SELECT * FROM ${table}`)).rows,[{cover_image_url:"/legacy.jpg",cover_image_urls:[]}]);
    await client.query(`UPDATE ${table} SET cover_image_urls=$1`,[["/1.jpg","/2.jpg","/3.jpg","/4.jpg"]]);
    await client.query("SAVEPOINT limit_test");
    await assert.rejects(client.query(`UPDATE ${table} SET cover_image_urls=$1`,[Array(5).fill("/a.jpg")]),{code:"23514"});
    await client.query("ROLLBACK TO SAVEPOINT limit_test");
  }
  console.log("PASS migration 50: old covers preserved; 4 allowed, 5 rejected; isolated transaction tables");
} finally {await client.query("ROLLBACK");client.release();await db.end();}
