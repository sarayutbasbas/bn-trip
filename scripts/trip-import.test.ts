import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { Pool } from "pg";
import { createTripTemplate, parseTripImport, IMPORT_EXAMPLE_CODE } from "../src/lib/trip-import";
import { saveTripImport } from "../src/lib/trip-import-save";

async function fixture() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createTripTemplate());
  const trips = workbook.getWorksheet("ทริป")!;
  trips.getRow(2).values = ["VN01", "Vietnam history", "VN", "ฮานอย", "2025-11-01", "2025-11-03", "", "", 20000, 0, "", ""];
  trips.getRow(3).values = ["JP01", "Japan history", "JP", "Tokyo", "2025-12-01", "2025-12-02", "", "", 30000, 0, "", ""];
  const plans = workbook.getWorksheet("ไทม์ไลน์")!;
  plans.getRow(2).values = ["VN01", "PLAN01", "2025-11-01", "", "Lunch"];
  plans.getRow(3).values = ["VN01", "PLAN02", "2025-11-01", "09:00", "Airport"];
  plans.getRow(4).values = ["JP01", "PLAN01", "2025-12-01", "12:00", "Museum"];
  const expenses = workbook.getWorksheet("ค่าใช้จ่าย")!;
  expenses.getRow(2).values = ["VN01", "PLAN01", "", "Pho", "อาหาร", 100000, "VND", 0.0013];
  expenses.getRow(3).values = ["VN01", "PLAN01", "", "Coffee", "อาหาร", 60];
  expenses.getRow(4).values = ["JP01", "PLAN01", "", "Ticket", "กิจกรรม", 1000, "JPY", 0.23];
  expenses.getRow(5).values = ["VN01", "", "2025-11-02", "Taxi", "เดินทาง", 350];
  return workbook;
}
async function parse(workbook: ExcelJS.Workbook) { return parseTripImport(await workbook.xlsx.writeBuffer()); }

test("each data sheet has a highlighted example that is never imported, even after moving", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createTripTemplate());
  for (const name of ["ทริป", "ไทม์ไลน์", "ค่าใช้จ่าย", "ที่พัก", "เที่ยวบิน"]) {
    const sheet = workbook.getWorksheet(name)!;
    assert.equal(sheet.getCell("A2").value, IMPORT_EXAMPLE_CODE);
    assert.equal(sheet.getCell("A2").fill.type, "pattern");
    assert.match(sheet.getRow(2).getCell(sheet.columnCount).text, /ไม่นำเข้า/);
    sheet.getRow(800).values = sheet.getRow(2).values;
    sheet.getRow(2).values = [];
    // Formatting far below data must not count toward the 500-booking limit.
    sheet.getCell("A3000").numFmt = "@";
  }
  await assert.rejects(() => parse(workbook), /ยังไม่มีข้อมูลทริป/);
  workbook.getWorksheet("ทริป")!.getRow(3).values = ["REAL01", "Real trip", "VN", "ฮานอย", "2025-11-01", "2025-11-05"];
  const batch = await parse(workbook);
  assert.equal(batch.trips.length, 1);
  assert.equal(batch.plans.length + batch.stays.length + batch.flights.length + batch.expenseCount, 0);
});

test("copying each example and changing the trip code imports all five sheets together", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createTripTemplate());
  for (const name of ["ทริป", "ไทม์ไลน์", "ค่าใช้จ่าย", "ที่พัก", "เที่ยวบิน"]) {
    const sheet = workbook.getWorksheet(name)!;
    sheet.getRow(3).values = sheet.getRow(2).values;
    sheet.getCell("A3").value = "MYTRIP01";
  }
  const batch = await parse(workbook);
  assert.deepEqual([batch.trips.length, batch.plans.length, batch.expenseCount, batch.stays.length, batch.flights.length], [1, 1, 1, 1, 1]);
});

async function largeBookingFixture() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createTripTemplate());
  for (let index = 0; index < 100; index++) {
    const code = `TRIP${index}`;
    workbook.getWorksheet("ทริป")!.getRow(index + 3).values = [code, `History ${index}`, "VN", "ฮานอย", "2025-11-01", "2025-11-05"];
    for (let item = 0; item < 5; item++) {
      const row = index * 5 + item + 3;
      workbook.getWorksheet("ที่พัก")!.getRow(row).values = [code, `Hotel ${item}`, "Hanoi", "2025-11-01", "14:00", "2025-11-02", "12:00", 100, "THB", 1, "direct", "ใช่"];
      workbook.getWorksheet("เที่ยวบิน")!.getRow(row).values = [code, "ภายในทริป", item + 1, "VN616", "Vietnam Airlines", "BKK", "HAN", "2025-11-01", "10:00", "+07:00", "2025-11-01", "12:00", "+07:00", 200, "THB", 1];
    }
  }
  return workbook;
}

test("accepts 500 hotels and 500 flights plus examples and rejects the 501st real row", async () => {
  const workbook = await largeBookingFixture();
  const batch = await parse(workbook);
  assert.equal(batch.trips.length, 100);
  assert.equal(batch.stays.length, 500);
  assert.equal(batch.flights.length, 500);
  workbook.getWorksheet("ที่พัก")!.getRow(503).values = workbook.getWorksheet("ที่พัก")!.getRow(3).values;
  await assert.rejects(() => parse(workbook), /ที่พัก: ไม่เกิน 500 แถวข้อมูลจริง/);
});

test("bulk import saves 500 hotels and 500 flights atomically and retries without duplicates", { skip: !process.env.TRIP_IMPORT_TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.TRIP_IMPORT_TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["trips", "itineraries", "trip_accommodations", "trip_flight_segments", "trip_flight_passengers"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    const batch = await parse(await largeBookingFixture());
    const result = await saveTripImport(client, "00000000-0000-4000-a000-000000000001", batch, "large-bookings");
    assert.deepEqual(result, { count: 100, planCount: 1000, expenseCount: 1000, stayCount: 500, flightCount: 500 });
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_accommodations")).rows[0].n, 500);
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_flight_segments WHERE itinerary_id IS NOT NULL AND ticket_cost_item_id IS NOT NULL")).rows[0].n, 500);
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_flight_passengers")).rows[0].n, 500);
    assert.equal(Number((await client.query("SELECT sum((cost->>'value')::numeric) n FROM itineraries CROSS JOIN LATERAL jsonb_array_elements(cost_items) cost")).rows[0].n), 150000);
    assert.equal((await saveTripImport(client, "00000000-0000-4000-a000-000000000001", batch, "large-bookings")).count, 0);
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});

test("more than ten hotels and flights in ONE trip retain every link, including zero-price tickets", { skip: !process.env.TRIP_IMPORT_TEST_DATABASE_URL }, async () => {
  const workbook = await bookingFixture();
  const hotels = workbook.getWorksheet("ที่พัก")!, flights = workbook.getWorksheet("เที่ยวบิน")!;
  for (let index = 0; index < 20; index++) {
    hotels.getRow(index + 2).values = ["VN01", `Hotel ${index}`, "Hanoi", "2025-11-01", "14:00", "2025-11-02", "12:00", 100, "THB", 1, "direct", "ใช่"];
    flights.getRow(index + 2).values = ["VN01", "ภายในทริป", index + 1, "VN616", "Vietnam Airlines", "BKK", "HAN", "2025-11-01", "10:00", "+07:00", "2025-11-01", "12:00", "+07:00", index === 0 ? 0 : 200, "THB", 1];
  }
  const batch = await parse(workbook);
  const pool = new Pool({ connectionString: process.env.TRIP_IMPORT_TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["trips", "itineraries", "trip_accommodations", "trip_flight_segments", "trip_flight_passengers"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    await saveTripImport(client, "00000000-0000-4000-a000-000000000001", batch, "twenty-bookings");
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_accommodations")).rows[0].n, 20);
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_flight_segments WHERE itinerary_id IS NOT NULL")).rows[0].n, 20);
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_flight_segments WHERE ticket_cost_item_id IS NULL AND ticket_price IS NULL")).rows[0].n, 1);
    assert.equal((await client.query("SELECT count(*)::int n FROM itineraries i JOIN trip_accommodations a ON a.id=i.accommodation_id WHERE i.cost_items->0->>'id'=a.cost_item_id::text")).rows[0].n, 20);
    await client.query("SAVEPOINT failed_booking_import");
    batch.flights[0].airlineName = "x".repeat(1000);
    await assert.rejects(() => saveTripImport(client, "00000000-0000-4000-a000-000000000001", batch, "failed-bookings"));
    await client.query("ROLLBACK TO SAVEPOINT failed_booking_import");
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_accommodations")).rows[0].n, 20);
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_flight_segments")).rows[0].n, 20);
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});

test("links multiple trips, converts historical currency, and creates daily expense plans", async () => {
  const batch = await parse(await fixture());
  assert.equal(batch.trips.length, 2);
  assert.equal(batch.plans.length, 4);
  assert.equal(batch.expenseCount, 4);
  const lunch = batch.plans.find(plan => plan.tripCode === "VN01" && plan.code === "PLAN01")!;
  assert.equal(lunch.time, "09:01");
  assert.equal(lunch.costs.reduce((sum, cost) => sum + cost.value, 0), 190);
  assert.equal(batch.plans.find(plan => plan.tripCode === "JP01")!.costs[0].value, 230);
  assert.equal(batch.plans.find(plan => plan.code.startsWith("@expenses"))!.day, 2);
});

test("rejects broken references, out-of-trip dates, missing FX rates, and duplicate plan codes", async () => {
  for (const [sheet, row, column, value, message] of [
    ["ค่าใช้จ่าย", 2, 2, "MISSING", /ไม่พบรหัสรายการ/],
    ["ค่าใช้จ่าย", 2, 1, "JP01", /วันที่|เรท|ไม่พบ/],
    ["ไทม์ไลน์", 2, 3, "2020-01-01", /วันที่ต้องอยู่/],
    ["ค่าใช้จ่าย", 2, 8, "", /เรท/],
    ["ไทม์ไลน์", 3, 2, "PLAN01", /ซ้ำ/],
    ["ทริป", 3, 1, "VN01", /รหัสทริป.*ซ้ำ/],
  ] as const) {
    const workbook = await fixture();
    workbook.getWorksheet(sheet)!.getCell(row, column).value = value;
    // An explicit mismatched date must not silently move a cost across trips.
    if (sheet === "ค่าใช้จ่าย" && column === 1) workbook.getWorksheet(sheet)!.getCell(row, 3).value = "2025-11-01";
    await assert.rejects(() => parse(workbook), message);
  }
});

test("splits more than 30 unlinked daily expenses and supports legacy trip-only files", async () => {
  const workbook = await fixture();
  const expenses = workbook.getWorksheet("ค่าใช้จ่าย")!;
  for (let index = 6; index <= 36; index++) expenses.getRow(index).values = ["VN01", "", "2025-11-02", `Taxi ${index}`, "เดินทาง", 10];
  const batch = await parse(workbook);
  assert.deepEqual(batch.plans.filter(plan => plan.code.startsWith("@expenses")).map(plan => plan.costs.length), [30, 2]);
  workbook.removeWorksheet("ไทม์ไลน์"); workbook.removeWorksheet("ค่าใช้จ่าย");
  workbook.getWorksheet("ทริป")!.spliceColumns(1, 1);
  const legacy = await parse(workbook);
  assert.equal(legacy.trips.length, 2); assert.equal(legacy.plans.length, 0);
});

test("Postgres imports are linked, retry-safe, and rollback all new records on failure", { skip: !process.env.TRIP_IMPORT_TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.TRIP_IMPORT_TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Temporary clones shadow real tables; no application records are modified.
    await client.query("CREATE TEMP TABLE trips (LIKE public.trips INCLUDING ALL) ON COMMIT DROP");
    await client.query("CREATE TEMP TABLE itineraries (LIKE public.itineraries INCLUDING ALL) ON COMMIT DROP");
    const batch = await parse(await fixture());
    const userId = "00000000-0000-4000-a000-000000000001";
    assert.deepEqual(await saveTripImport(client, userId, batch, "test-batch"), { count: 2, planCount: 4, expenseCount: 4, stayCount: 0, flightCount: 0 });
    assert.deepEqual(await saveTripImport(client, userId, batch, "test-batch"), { count: 0, planCount: 0, expenseCount: 0, stayCount: 0, flightCount: 0 });
    const result = await client.query("SELECT sum((cost->>'value')::numeric) AS total FROM itineraries CROSS JOIN LATERAL jsonb_array_elements(cost_items) cost");
    assert.equal(Number(result.rows[0].total), 770);
    const linked = await client.query("SELECT count(*)::int AS count FROM itineraries i JOIN trips t ON t.id=i.trip_id");
    assert.equal(linked.rows[0].count, 4);
    await client.query("SAVEPOINT invalid_batch");
    batch.trips[1].name = "x".repeat(200);
    await assert.rejects(() => saveTripImport(client, userId, batch, "invalid-batch"));
    await client.query("ROLLBACK TO SAVEPOINT invalid_batch");
    const counts = await client.query("SELECT (SELECT count(*)::int FROM trips) trips,(SELECT count(*)::int FROM itineraries) plans");
    assert.deepEqual(counts.rows[0], { trips: 2, plans: 4 });
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});

async function bookingFixture() {
  const workbook = await fixture();
  workbook.getWorksheet("ที่พัก")!.getRow(2).values = ["VN01", "Hanoi Hotel", "Hanoi", "2025-11-01", "14:00", "2025-11-03", "12:00", 5000, "THB", 1, "agoda", "ใช่"];
  workbook.getWorksheet("เที่ยวบิน")!.getRow(2).values = ["VN01", "ขาไป", 1, "VN616", "Vietnam Airlines", "BKK", "HAN", "2025-11-01", "10:00", "+07:00", "2025-11-01", "12:00", "+07:00", 3000, "THB", 1, "ABC", "Economy", "12A", "", "7 kg", "23 kg"];
  return workbook;
}

test("booking errors name the sheet, row, and exact Excel cell", async () => {
  const workbook = await bookingFixture();
  const batch = await parse(workbook);
  assert.equal(batch.stays.length, 1); assert.equal(batch.flights.length, 1);
  assert.equal(batch.flights[0].departureAt, "2025-11-01T03:00:00.000Z");
  workbook.getWorksheet("ที่พัก")!.getCell("F2").value = "2025-10-31";
  workbook.getWorksheet("เที่ยวบิน")!.getCell("J2").value = "invalid";
  await assert.rejects(() => parse(workbook), error => error instanceof Error && /ที่พัก แถว 2 ช่อง F2/.test(error.message) && /เที่ยวบิน แถว 2 ช่อง J2/.test(error.message));
});

test("booking imports create actual hotel/flight records and linked costs exactly once", { skip: !process.env.TRIP_IMPORT_TEST_DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: process.env.TRIP_IMPORT_TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["trips", "itineraries", "trip_accommodations", "trip_flight_segments", "trip_flight_passengers"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    const batch = await parse(await bookingFixture());
    const userId = "00000000-0000-4000-a000-000000000001";
    assert.deepEqual(await saveTripImport(client, userId, batch, "bookings"), { count: 2, planCount: 7, expenseCount: 6, stayCount: 1, flightCount: 1 });
    assert.equal((await saveTripImport(client, userId, batch, "bookings")).count, 0);
    const result = await client.query("SELECT sum((cost->>'value')::numeric) AS total FROM itineraries CROSS JOIN LATERAL jsonb_array_elements(cost_items) cost");
    assert.equal(Number(result.rows[0].total), 8770);
    assert.equal((await client.query("SELECT count(*)::int n FROM itineraries WHERE accommodation_id IS NOT NULL")).rows[0].n, 2);
    assert.equal((await client.query("SELECT count(*)::int n FROM trip_flight_segments WHERE itinerary_id IS NOT NULL AND ticket_cost_item_id IS NOT NULL")).rows[0].n, 1);
    assert.equal((await client.query("SELECT seat_number FROM trip_flight_passengers")).rows[0].seat_number, "12A");
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});
