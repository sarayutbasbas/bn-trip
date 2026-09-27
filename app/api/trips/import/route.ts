import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { createTripTemplate, IMPORT_MAX_BYTES, parseTripImport } from "@/src/lib/trip-import";
import { saveTripImport } from "@/src/lib/trip-import-save";

export const runtime = "nodejs";

export async function GET() {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const buffer = await createTripTemplate();
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="RouteRao-trip-template.xlsx"',
    "Cache-Control": "no-store",
  } });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบเพื่อนำเข้าทริป" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > IMPORT_MAX_BYTES + 10000) return NextResponse.json({ error: "ไฟล์ต้องไม่เกิน 2 MB" }, { status: 413 });
  let batch: Awaited<ReturnType<typeof parseTripImport>>;
  let confirm = false;
  let fingerprint: string;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("กรุณาเลือกไฟล์ Excel (.xlsx)");
    if (file.size > IMPORT_MAX_BYTES) throw new Error("ไฟล์ต้องไม่เกิน 2 MB");
    const buffer = await file.arrayBuffer();
    batch = await parseTripImport(buffer);
    const fingerprintData = !batch.plans.length && !batch.stays.length && !batch.flights.length && batch.trips.every(trip => !trip.code)
      ? batch.trips.map(trip => { const legacy = { ...trip } as Partial<typeof trip>; delete legacy.code; return legacy; })
      : !batch.stays.length && !batch.flights.length ? { trips: batch.trips, plans: batch.plans, expenseCount: batch.expenseCount } : batch;
    fingerprint = createHash("sha256").update(session.userId).update(JSON.stringify(fingerprintData)).digest("hex");
    confirm = form.get("confirm") === "true";
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }
  const { trips, plans } = batch;
  if (!confirm) return NextResponse.json({ trips: trips.map(trip => {
    const tripPlans = plans.filter(plan => plan.tripCode === trip.code);
    const stays = batch.stays.filter(stay => stay.tripCode === trip.code), flights = batch.flights.filter(flight => flight.tripCode === trip.code);
    const bookingTotal = [...stays, ...flights].reduce((sum, item) => sum + Math.round(item.amount * item.rate * 100) / 100, 0);
    return { name: trip.name, code: trip.code, destination: trip.destination, outboundDate: trip.outboundDate, returnDate: trip.returnDate,
      stays: stays.map(stay => ({ name: stay.name, nights: stay.checkOutDay - stay.checkInDay, totalThb: Math.round(stay.amount * stay.rate * 100) / 100 })),
      flights: flights.map(flight => ({ name: `${flight.airlineCode}${flight.flightNumber} · ${flight.departureCode} → ${flight.arrivalCode}`, departure: flight.departureLocal, totalThb: Math.round(flight.amount * flight.rate * 100) / 100 })),
      linkedPlanCount: stays.reduce((sum, stay) => sum + stay.checkOutDay - stay.checkInDay, 0) + flights.length,
      expenseCount: tripPlans.reduce((sum, plan) => sum + plan.costs.length, 0) + [...stays, ...flights].filter(item => item.amount > 0).length,
      totalThb: bookingTotal + tripPlans.reduce((sum, plan) => sum + plan.costs.reduce((total, cost) => total + cost.value, 0), 0),
      plans: tripPlans.map(plan => ({ name: plan.name, date: plan.date, time: plan.time, costCount: plan.costs.length, totalThb: plan.costs.reduce((sum, cost) => sum + cost.value, 0) })),
    };
  }) });
  try {
    await ensureLatestDatabaseSchema();
    const created = await transaction(client => saveTripImport(client, session.userId, batch, fingerprint));
    return NextResponse.json({ created: created.count, plansCreated: created.planCount, expensesCreated: created.expenseCount, staysCreated: created.stayCount, flightsCreated: created.flightCount, skipped: trips.length - created.count });
  } catch (error) {
    console.error("Trip import failed", error);
    return NextResponse.json({ error: "นำเข้าไม่สำเร็จ ยังไม่มีทริปถูกสร้าง กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
