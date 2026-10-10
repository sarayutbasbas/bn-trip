import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
const db = new Pool({connectionString:'postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip'});
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query('CREATE TEMP TABLE trip_accommodations (name text) ON COMMIT DROP');
  await client.query("INSERT INTO trip_accommodations VALUES ('Existing stay')");
  const sql = readFileSync(new URL('../db/migrations/0054_accommodation_payment_status.sql',import.meta.url),'utf8');
  await client.query(sql);
  await client.query(sql);
  assert.deepEqual((await client.query('SELECT * FROM trip_accommodations')).rows,[{name:'Existing stay',payment_status:null}]);
  await client.query("UPDATE trip_accommodations SET payment_status='pending'");
  await client.query("UPDATE trip_accommodations SET payment_status='paid'");
  const dateSql = readFileSync(new URL('../db/migrations/0055_accommodation_payment_date.sql',import.meta.url),'utf8');
  await client.query(dateSql);await client.query(dateSql);
  assert.deepEqual((await client.query('SELECT payment_status,payment_date FROM trip_accommodations')).rows,[{payment_status:'paid',payment_date:null}]);
  await client.query("UPDATE trip_accommodations SET payment_date='2099-01-01'");
  assert.equal((await client.query('SELECT payment_date::text FROM trip_accommodations')).rows[0].payment_date,'2099-01-01');
  await assert.rejects(client.query("UPDATE trip_accommodations SET payment_status='invalid'"));
  console.log('PASS idempotent payment migration, preserved legacy rows, valid states and constraint');
} finally {
  await client.query('ROLLBACK');client.release();await db.end();
}
