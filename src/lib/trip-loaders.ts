import type { SessionUser } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import {
  getDemoCards,
  getDemoItineraries,
  getDemoTrip,
  getDemoTrips,
  isDemoTrip,
} from "@/src/lib/demo-data";
import {
  getTripRole,
  tripAccessSql,
  tripMembersSql,
  tripRoleSql,
} from "@/src/lib/trip-access";

export type DashboardPayload = {
  ongoing: unknown[];
  upcoming: unknown[];
  past: unknown[];
  counts: { total: number; ongoing: number; upcoming: number; past: number };
};

export type TripDirectoryPayload = {
  items: unknown[];
  total: number;
  years: number[];
  hasMore: boolean;
};

function clientSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function loadDashboard(session: SessionUser): Promise<DashboardPayload> {
  if (session.isDemo)
    return getDemoTrips(new URLSearchParams("mode=dashboard")) as DashboardPayload;
  await ensureLatestDatabaseSchema();
  const access = tripAccessSql("t");
  const role = tripRoleSql("t");
  const members = tripMembersSql("t");
  const [ongoing, upcoming, past, counts] = await Promise.all([
    query(`SELECT t.*,${role},${members} FROM trips t WHERE ${access} AND COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) ORDER BY COALESCE(t.outbound_departure_at,t.start_date::timestamp) ASC LIMIT 1`, [session.userId]),
    query(`SELECT t.*,${role},${members} FROM trips t WHERE ${access} AND COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) ORDER BY COALESCE(t.outbound_departure_at,t.start_date::timestamp) ASC LIMIT 3`, [session.userId]),
    query(`SELECT t.*,${role},${members} FROM trips t WHERE ${access} AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) ORDER BY COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp) DESC LIMIT 2`, [session.userId]),
    query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')))::int AS ongoing,count(*) FILTER (WHERE COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')))::int AS upcoming,count(*) FILTER (WHERE COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')))::int AS past FROM trips t WHERE ${access}`, [session.userId]),
  ]);
  return clientSafe({
    ongoing: ongoing.rows,
    upcoming: upcoming.rows,
    past: past.rows,
    counts: counts.rows[0] as DashboardPayload["counts"],
  });
}

export async function loadTripDirectory(
  session: SessionUser,
  params: URLSearchParams,
): Promise<TripDirectoryPayload> {
  params.set("mode", "list");
  params.set("limit", "20");
  params.set("offset", "0");
  if (session.isDemo)
    return getDemoTrips(params) as TripDirectoryPayload;

  await ensureLatestDatabaseSchema();
  const access = tripAccessSql("t");
  const role = tripRoleSql("t");
  const members = tripMembersSql("t");
  const status = params.get("status") || "all";
  const year = Number(params.get("year") || 0);
  const search = (params.get("q") || "").trim().slice(0, 80);
  const sort = params.get("sort") || "latest";
  const limit = 20;
  const values: Array<string | number> = [session.userId];
  const where = [access];
  if (status === "ongoing")
    where.push("COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
  if (status === "upcoming")
    where.push("COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
  if (status === "past")
    where.push("COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))");
  if (year >= 2000 && year <= 2200) {
    values.push(year);
    where.push(`EXTRACT(YEAR FROM start_date)=$${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    where.push(`(name ILIKE $${values.length} OR destination ILIKE $${values.length})`);
  }
  const order =
    sort === "oldest"
      ? "t.start_date ASC,t.id ASC"
      : sort === "name"
        ? "t.name ASC,t.id ASC"
        : sort === "nearest"
          ? "ABS(EXTRACT(EPOCH FROM (COALESCE(t.outbound_departure_at,t.start_date::timestamp)-(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))))) ASC,t.id ASC"
          : "COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp) DESC,t.id DESC";
  const clause = where.join(" AND ");
  const [items, total, years] = await Promise.all([
    query(`SELECT t.*,${role},${members} FROM trips t WHERE ${clause} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, 0]),
    query(`SELECT count(*)::int AS count FROM trips t WHERE ${clause}`, values),
    query(`SELECT DISTINCT EXTRACT(YEAR FROM t.start_date)::int AS year FROM trips t WHERE ${access} ORDER BY year DESC`, [session.userId]),
  ]);
  const count = Number(total.rows[0]?.count || 0);
  return clientSafe({
    items: items.rows,
    total: count,
    years: years.rows.map((row) => Number(row.year)),
    hasMore: items.rows.length < count,
  });
}

export async function loadTrip(session: SessionUser, id: string) {
  if (session.isDemo) return getDemoTrip(id);
  await ensureLatestDatabaseSchema();
  const result = await query(
    `SELECT t.*,${tripRoleSql("t")},${tripMembersSql("t")} FROM trips t WHERE t.id=$2 AND (t.owner_id=$1 OR EXISTS(SELECT 1 FROM trip_collaborators c WHERE c.trip_id=t.id AND c.user_id=$1))`,
    [session.userId, id],
  );
  return clientSafe(result.rows[0] ?? null);
}

export async function loadItineraries(session: SessionUser, id: string) {
  if (session.isDemo) return isDemoTrip(id) ? getDemoItineraries(id) : [];
  if (!(await getTripRole(id, session.userId))) return [];
  const result = await query(
    "SELECT i.* FROM itineraries i WHERE i.trip_id=$1 AND i.place_name IS NOT NULL ORDER BY i.day_number,i.start_time NULLS LAST,i.sort_order",
    [id],
  );
  return clientSafe(result.rows);
}

export async function loadTripCards(session: SessionUser, id: string) {
  if (session.isDemo) return isDemoTrip(id) ? getDemoCards() : [];
  const result = await query(`WITH accessible_trip AS (
      SELECT trip.id,trip.owner_id FROM trips trip WHERE trip.id=$2 AND (trip.owner_id=$1 OR EXISTS (
        SELECT 1 FROM trip_collaborators access_member WHERE access_member.trip_id=trip.id AND access_member.user_id=$1
      ))
    ), trip_members AS (
      SELECT accessible_trip.owner_id AS user_id,'owner'::text AS member_role FROM accessible_trip
      UNION ALL
      SELECT collaborator.user_id,'collaborator'::text FROM trip_collaborators collaborator
      JOIN accessible_trip ON accessible_trip.id=collaborator.trip_id
      WHERE collaborator.user_id IS NOT NULL AND collaborator.user_id<>accessible_trip.owner_id
    )
    SELECT card.id,card.nickname,card.brand,card.last_four,card.is_active,card.sort_order,
      member.id AS owner_id,COALESCE(NULLIF(member.display_name,''),split_part(member.email,'@',1),'Member') AS owner_name,
      member.email AS owner_email,member.avatar_url AS owner_avatar_url,(member.id=$1) AS is_own,trip_members.member_role
    FROM trip_members JOIN users member ON member.id=trip_members.user_id
    JOIN credit_cards card ON card.user_id=member.id AND card.is_active=true
    ORDER BY (trip_members.member_role='owner') DESC,member.display_name,card.sort_order,card.created_at DESC`, [session.userId, id]);
  return clientSafe(result.rows);
}
