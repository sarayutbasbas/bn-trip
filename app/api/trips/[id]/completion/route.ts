import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (session.isDemo)
    return NextResponse.json({ flightIncomplete: false, checklistIncomplete: false });
  await ensureLatestDatabaseSchema();
  if (!(await getTripRole(id, session.userId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await query<{
    has_flights: boolean;
    flight_count: number;
    insurance_complete: boolean;
    checklist_incomplete: boolean;
  }>(
    `SELECT trip.has_flights,
      (SELECT count(*)::int FROM trip_flight_segments flight WHERE flight.trip_id=trip.id) AS flight_count,
      EXISTS(
        SELECT 1 FROM trip_travel_insurance insurance
        WHERE insurance.trip_id=trip.id
          AND NOT EXISTS (
            SELECT 1 FROM (
              SELECT trip.owner_id AS user_id
              UNION ALL
              SELECT collaborator.user_id FROM trip_collaborators collaborator
              WHERE collaborator.trip_id=trip.id AND collaborator.user_id IS NOT NULL
            ) member
            WHERE NOT EXISTS (
              SELECT 1 FROM trip_travel_insurance_policies policy
              WHERE policy.trip_id=trip.id AND policy.user_id=member.user_id
                AND length(trim(policy.insured_name))>0
                AND length(trim(policy.provider_name))>0
                AND length(trim(policy.policy_number))>0
            ) AND NOT EXISTS (
              SELECT 1 FROM trip_travel_insurance_passengers passenger
              WHERE passenger.trip_id=trip.id AND passenger.user_id=member.user_id
                AND passenger.declined_insurance=true
            )
          )
      ) AS insurance_complete,
      EXISTS(
        SELECT 1 FROM trip_checklist_items item
        WHERE item.trip_id=trip.id AND item.completed_at IS NULL
      ) AS checklist_incomplete
     FROM trips trip WHERE trip.id=$1`,
    [id],
  );
  const status = result.rows[0];
  if (!status)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    flightIncomplete:
      status.has_flights &&
      (Number(status.flight_count) === 0 || !status.insurance_complete),
    checklistIncomplete: status.checklist_incomplete,
  });
}
