// Isolated local Docker fixtures only; never targets production data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { SignJWT } from "jose";

const base = "http://localhost:8001";
const db = new Pool({ connectionString: "postgresql://bntrip:bntrip_dev_password@localhost:5434/bntrip" });
const owner = randomUUID();
const trip = randomUUID();
const email = `offline-member-${owner}@example.invalid`;
const env = JSON.parse(execFileSync("docker", ["inspect", "bn-trip-app-1"], { encoding: "utf8" }))[0].Config.Env;
const secret = env.find((value) => value.startsWith("AUTH_SECRET="))?.slice(12);
const token = await new SignJWT({ email, displayName: "Offline member fixture", demo: false })
  .setProtectedHeader({ alg: "HS256" }).setSubject(owner).setIssuedAt().setExpirationTime("1h")
  .sign(new TextEncoder().encode(secret));

async function api(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: { cookie: `bn_trip_session=${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert(response.ok, `${response.status} ${JSON.stringify(data)}`);
  return data;
}

try {
  await db.query("INSERT INTO users(id,email,display_name) VALUES($1,$2,'Offline member fixture')", [owner, email]);
  await db.query("INSERT INTO trips(id,owner_id,name,destination,start_date,total_days,budget_thb,shopping_budget_thb) VALUES($1,$2,'Offline member fixture','Bangkok','2030-01-01',2,1000,0)", [trip, owner]);

  const guest = await api(`/api/trips/${trip}/expense-guests`, "POST", { name: "Guest", participantType: "guest" });
  const offlineMember = await api(`/api/trips/${trip}/expense-guests`, "POST", { name: "Member without email", participantType: "member" });
  assert.equal(guest.participant_type, "guest");
  assert.equal(offlineMember.participant_type, "member");
  const unchangedOfflineMember = await api(`/api/trips/${trip}/expense-guests`, "POST", { name: "Member without email" });
  assert.equal(unchangedOfflineMember.participant_type, "member");
  const participants = await api(`/api/trips/${trip}/expense-guests`);
  assert.deepEqual(participants.map((person) => person.participant_type), ["guest", "member"]);

  await api(`/api/trips/${trip}/itineraries`, "POST", {
    dayNumber: 1,
    timeSlot: "morning",
    startTime: "08:00",
    placeName: "Shared meal",
    costItems: [{ id: randomUUID(), key: "Meal", value: 300, splitMemberIds: [owner], splitGuestIds: [guest.id, offlineMember.id], paidBy: { type: "member", id: owner } }],
  });
  const trips = await api("/api/trips?mode=list");
  assert.equal(Number(trips.items.find((item) => item.id === trip).actual_spent_thb), 200);

  for (const title of ["Pack passport", "Pack charger"]) {
    await api(`/api/trips/${trip}/checklist`, "POST", { title, categoryName: "Packing" });
  }
  let workspace = await api(`/api/trips/${trip}/workspace?tab=checklist`);
  assert.equal(workspace.checklist.filter((item) => item.category_name === "Packing").length, 2);
  await api(`/api/trips/${trip}/checklist`, "PATCH", { categoryName: "Packing", assignedUserId: owner });
  workspace = await api(`/api/trips/${trip}/workspace?tab=checklist`);
  assert(workspace.checklist.filter((item) => item.category_name === "Packing").every((item) => item.assigned_user_id === owner));
  await api(`/api/trips/${trip}/checklist`, "PATCH", { categoryName: "Packing", assignedUserId: null });
  await api(`/api/trips/${trip}/checklist`, "DELETE", { categoryName: "Packing" });
  workspace = await api(`/api/trips/${trip}/workspace?tab=checklist`);
  assert.equal(workspace.checklist.filter((item) => item.category_name === "Packing").length, 0);
  console.log("PASS: offline-member budget inclusion and checklist group assignment/delete APIs");
} finally {
  await db.query("DELETE FROM users WHERE id=$1", [owner]);
  await db.end();
}
