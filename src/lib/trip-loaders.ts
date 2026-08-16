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
  tripReviewSummarySql,
  tripRoleSql,
} from "@/src/lib/trip-access";
import { inferTripCountry } from "@/src/lib/countries";

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

export type TravelAnalyticsPayload = {
  totals: {
    trips: number;
    countries: number;
    expense: number;
    travelExpense: number;
    shoppingExpense: number;
    averageExpense: number;
    averageTravelExpense: number;
    averageShoppingExpense: number;
  };
  years: Array<{
    year: number;
    trips: number;
    totalExpense: number;
    averageExpense: number;
  }>;
  countries: Array<{
    country: string;
    countryCode: string;
    trips: number;
    totalExpense: number;
  }>;
};

type AnalyticsTripRow = {
  year: number;
  country: string;
  country_code: string | null;
  travel_expense: string | number;
  shopping_expense: string | number;
};

function clientSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function aggregateTravelAnalytics(rows: AnalyticsTripRow[]): TravelAnalyticsPayload {
  const years = new Map<number, { trips: number; totalExpense: number }>();
  const countries = new Map<
    string,
    { country: string; countryCode: string; trips: number; totalExpense: number }
  >();
  let travelExpense = 0;
  let shoppingExpense = 0;

  for (const row of rows) {
    const travel = Number(row.travel_expense || 0);
    const shopping = Number(row.shopping_expense || 0);
    const total = travel + shopping;
    travelExpense += travel;
    shoppingExpense += shopping;
    const year = Number(row.year);
    const yearEntry = years.get(year) || { trips: 0, totalExpense: 0 };
    yearEntry.trips += 1;
    yearEntry.totalExpense += total;
    years.set(year, yearEntry);
    const country = row.country.trim() || "ไม่ระบุประเทศ";
    const countryCode = (row.country_code || "").trim().toUpperCase();
    const countryKey = countryCode || country;
    const countryEntry = countries.get(countryKey) || {
      country,
      countryCode,
      trips: 0,
      totalExpense: 0,
    };
    countryEntry.trips += 1;
    countryEntry.totalExpense += total;
    countries.set(countryKey, countryEntry);
  }

  const tripCount = rows.length;
  const expense = travelExpense + shoppingExpense;
  return {
    totals: {
      trips: tripCount,
      countries: countries.size,
      expense,
      travelExpense,
      shoppingExpense,
      averageExpense: tripCount ? expense / tripCount : 0,
      averageTravelExpense: tripCount ? travelExpense / tripCount : 0,
      averageShoppingExpense: tripCount ? shoppingExpense / tripCount : 0,
    },
    years: [...years.entries()]
      .map(([year, value]) => ({
        year,
        trips: value.trips,
        totalExpense: value.totalExpense,
        averageExpense: value.trips ? value.totalExpense / value.trips : 0,
      }))
      .sort((left, right) => right.year - left.year),
    countries: [...countries.entries()]
      .map(([, value]) => value)
      .sort(
        (left, right) =>
          right.trips - left.trips ||
          right.totalExpense - left.totalExpense ||
          left.country.localeCompare(right.country),
      ),
  };
}

export async function loadTravelAnalytics(
  session: SessionUser,
): Promise<TravelAnalyticsPayload> {
  if (session.isDemo) {
    const dashboard = getDemoTrips(
      new URLSearchParams("mode=dashboard"),
    ) as { past: Array<{ id: string; start_date: string; destination: string }> };
    const rows = dashboard.past.map((trip) => {
      let travelExpense = 0;
      let shoppingExpense = 0;
      for (const itinerary of getDemoItineraries(trip.id) as Array<{
        cost_items?: Array<{ value?: number; category?: string }>;
      }>) {
        for (const cost of itinerary.cost_items || []) {
          const amount = Number(cost.value || 0);
          if ((cost.category || "").trim().toLowerCase() === "shopping")
            shoppingExpense += amount;
          else travelExpense += amount;
        }
      }
      return {
        year: Number(trip.start_date.slice(0, 4)),
        country:
          inferTripCountry(trip.destination).nameEn,
        country_code: inferTripCountry(trip.destination).code,
        travel_expense: travelExpense,
        shopping_expense: shoppingExpense,
      };
    });
    return aggregateTravelAnalytics(rows);
  }

  await ensureLatestDatabaseSchema();
  const result = await query<AnalyticsTripRow>(
    `WITH accessible_past AS (
       SELECT t.id,EXTRACT(YEAR FROM t.start_date)::int AS year,
         COALESCE(NULLIF(t.country_name,''),NULLIF(btrim(regexp_replace(t.destination,'^.*,','')),''),'ไม่ระบุประเทศ') AS country,
         t.country_code
       FROM trips t
       WHERE ${tripAccessSql("t")}
         AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)
           < (now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok'))
     )
     SELECT trip.year,trip.country,trip.country_code,
       COALESCE(SUM(CASE WHEN lower(COALESCE(cost.item->>'category',''))<>'shopping'
         AND COALESCE(cost.item->>'value','')~'^-?[0-9]+([.][0-9]+)?$'
         THEN (cost.item->>'value')::numeric ELSE 0 END),0)::text AS travel_expense,
       COALESCE(SUM(CASE WHEN lower(COALESCE(cost.item->>'category',''))='shopping'
         AND COALESCE(cost.item->>'value','')~'^-?[0-9]+([.][0-9]+)?$'
         THEN (cost.item->>'value')::numeric ELSE 0 END),0)::text AS shopping_expense
     FROM accessible_past trip
     LEFT JOIN itineraries itinerary ON itinerary.trip_id=trip.id
     LEFT JOIN LATERAL jsonb_array_elements(COALESCE(itinerary.cost_items,'[]'::jsonb)) AS cost(item) ON true
     GROUP BY trip.id,trip.year,trip.country,trip.country_code
     ORDER BY trip.year DESC`,
    [session.userId],
  );
  return clientSafe(aggregateTravelAnalytics(result.rows));
}

export async function loadDashboard(session: SessionUser): Promise<DashboardPayload> {
  if (session.isDemo)
    return getDemoTrips(new URLSearchParams("mode=dashboard")) as DashboardPayload;
  await ensureLatestDatabaseSchema();
  const access = tripAccessSql("t");
  const role = tripRoleSql("t");
  const members = tripMembersSql("t");
  const reviews = tripReviewSummarySql("t");
  const [ongoing, upcoming, past, counts] = await Promise.all([
    query(`SELECT t.*,${role},${members},${reviews} FROM trips t WHERE ${access} AND COALESCE(t.outbound_departure_at,t.start_date::timestamp)<=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)>=(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) ORDER BY COALESCE(t.outbound_departure_at,t.start_date::timestamp) ASC LIMIT 1`, [session.userId]),
    query(`SELECT t.*,${role},${members},${reviews} FROM trips t WHERE ${access} AND COALESCE(t.outbound_departure_at,t.start_date::timestamp)>(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) ORDER BY COALESCE(t.outbound_departure_at,t.start_date::timestamp) ASC LIMIT 3`, [session.userId]),
    query(`SELECT t.*,${role},${members},${reviews} FROM trips t WHERE ${access} AND COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp)<(now() AT TIME ZONE COALESCE(t.timezone,'Asia/Bangkok')) ORDER BY COALESCE(t.return_departure_at,(t.start_date+t.total_days-1)::timestamp) DESC LIMIT 2`, [session.userId]),
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
  const reviews = tripReviewSummarySql("t");
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
    where.push(`(name ILIKE $${values.length} OR destination ILIKE $${values.length} OR country_name ILIKE $${values.length})`);
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
    query(`SELECT t.*,${role},${members},${reviews} FROM trips t WHERE ${clause} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, 0]),
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
    `SELECT t.*,${tripRoleSql("t")},${tripMembersSql("t")},${tripReviewSummarySql("t")} FROM trips t WHERE t.id=$2 AND (t.owner_id=$1 OR EXISTS(SELECT 1 FROM trip_collaborators c WHERE c.trip_id=t.id AND c.user_id=$1))`,
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
