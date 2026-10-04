// Fixed schema identifiers only; no request values are interpolated into SQL.
const tripTables = ["itineraries", "expenses", "flights", "lounges", "trip_checklist_items", "trip_documents", "trip_activity_logs", "trip_collaborators", "trip_flight_segments", "trip_accommodations", "trip_expense_guests", "trip_reviews", "trip_travel_insurance", "trip_travel_insurance_documents", "trip_travel_insurance_passengers", "trip_travel_insurance_policies"];
const personalTables = ["credit_cards", "checklist_master_categories", "checklist_master_items", "user_badge_visits", "user_favorite_accommodations"];
const contributions = [
  "SELECT t.user_id AS owner_id,pg_column_size(r)::bigint AS bytes FROM trip_idea_expense_guests r JOIN trip_ideas t ON t.id=r.trip_idea_id",
  "SELECT r.id AS owner_id,pg_column_size(r)::bigint AS bytes FROM users r",
  "SELECT r.owner_id,pg_column_size(r)::bigint AS bytes FROM trips r",
  "SELECT r.user_id AS owner_id,pg_column_size(r)::bigint AS bytes FROM trip_ideas r",
  "SELECT r.owner_user_id AS owner_id,pg_column_size(r)::bigint AS bytes FROM collaborator_contacts r",
  "SELECT t.user_id AS owner_id,pg_column_size(r)::bigint AS bytes FROM trip_idea_collaborators r JOIN trip_ideas t ON t.id=r.trip_idea_id",
  "SELECT t.owner_id,pg_column_size(r)::bigint AS bytes FROM trip_flight_passengers r JOIN trip_flight_segments f ON f.id=r.segment_id JOIN trips t ON t.id=f.trip_id",
  ...tripTables.map(table => `SELECT t.owner_id,pg_column_size(r)::bigint AS bytes FROM ${table} r JOIN trips t ON t.id=r.trip_id`),
  ...personalTables.map(table => `SELECT r.user_id AS owner_id,pg_column_size(r)::bigint AS bytes FROM ${table} r`),
];
export const ACCOUNT_STORAGE_SQL = `WITH contributions AS (${contributions.join(" UNION ALL ")}),
  sizes AS (SELECT owner_id,sum(bytes) AS bytes FROM contributions GROUP BY owner_id),
  trip_counts AS (SELECT owner_id,count(*) AS count FROM trips GROUP BY owner_id),
  idea_counts AS (SELECT user_id,count(*) AS count FROM trip_ideas GROUP BY user_id)
  SELECT u.id,u.display_name AS "displayName",u.email,
    COALESCE(t.count,0)::int AS "tripCount",COALESCE(i.count,0)::int AS "ideaCount",COALESCE(s.bytes,0)::float8 AS "dataBytes"
  FROM users u LEFT JOIN sizes s ON s.owner_id=u.id LEFT JOIN trip_counts t ON t.owner_id=u.id LEFT JOIN idea_counts i ON i.user_id=u.id`;

export const ACCOUNT_FILES_SQL = `SELECT DISTINCT "ownerId",url FROM (
  SELECT t.owner_id AS "ownerId",unnest(ARRAY[t.cover_image_url,t.summary_image_url] || COALESCE(t.cover_image_urls,'{}'::text[])) AS url FROM trips t
  UNION ALL SELECT t.user_id,unnest(ARRAY[t.cover_image_url] || COALESCE(t.cover_image_urls,'{}'::text[])) FROM trip_ideas t
  UNION ALL SELECT t.owner_id,r.image_url FROM itineraries r JOIN trips t ON t.id=r.trip_id
  UNION ALL SELECT t.owner_id,r.image_url FROM trip_accommodations r JOIN trips t ON t.id=r.trip_id
  UNION ALL SELECT t.owner_id,COALESCE(NULLIF(r.blob_url,''),r.stored_filename) FROM trip_documents r JOIN trips t ON t.id=r.trip_id
  UNION ALL SELECT id,avatar_url FROM users
) refs WHERE url IS NOT NULL`;
