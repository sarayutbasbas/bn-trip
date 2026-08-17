import { transaction } from "@/src/lib/db";

const migrations = [
  {
    version: 9,
    statements: [
      "ALTER TABLE trips ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Bangkok'",
      `CREATE TABLE IF NOT EXISTS trip_checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        title VARCHAR(240) NOT NULL,
        assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        completed_at TIMESTAMPTZ,
        completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS trip_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        title VARCHAR(180) NOT NULL,
        stored_filename TEXT NOT NULL,
        blob_url TEXT,
        original_filename TEXT NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        file_size BIGINT NOT NULL CHECK (file_size >= 0),
        uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      "ALTER TABLE trip_documents ADD COLUMN IF NOT EXISTS blob_url TEXT",
      `CREATE TABLE IF NOT EXISTS trip_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        entity_type VARCHAR(40) NOT NULL,
        entity_id UUID,
        action VARCHAR(20) NOT NULL,
        summary TEXT NOT NULL,
        before_data JSONB,
        after_data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        undone_at TIMESTAMPTZ,
        undone_by UUID REFERENCES users(id) ON DELETE SET NULL
      )`,
      "CREATE INDEX IF NOT EXISTS trip_checklist_trip_sort_idx ON trip_checklist_items(trip_id,sort_order,created_at)",
      "CREATE INDEX IF NOT EXISTS trip_documents_trip_created_idx ON trip_documents(trip_id,created_at DESC)",
      "CREATE INDEX IF NOT EXISTS trip_activity_trip_created_idx ON trip_activity_logs(trip_id,created_at DESC)",
    ],
  },
  {
    version: 10,
    statements: [
      `CREATE TABLE IF NOT EXISTS checklist_master_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS checklist_master_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES checklist_master_categories(id) ON DELETE CASCADE,
        title VARCHAR(240) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS checklist_master_category_name_unique_idx ON checklist_master_categories(user_id,lower(name))",
      "CREATE UNIQUE INDEX IF NOT EXISTS checklist_master_item_title_unique_idx ON checklist_master_items(user_id,category_id,lower(title))",
      "CREATE INDEX IF NOT EXISTS checklist_master_category_sort_idx ON checklist_master_categories(user_id,sort_order,created_at)",
      "CREATE INDEX IF NOT EXISTS checklist_master_item_sort_idx ON checklist_master_items(user_id,category_id,sort_order,created_at)",
      "ALTER TABLE trip_checklist_items ADD COLUMN IF NOT EXISTS master_item_id UUID REFERENCES checklist_master_items(id) ON DELETE SET NULL",
      "ALTER TABLE trip_checklist_items ADD COLUMN IF NOT EXISTS category_name VARCHAR(120) NOT NULL DEFAULT 'อื่น ๆ'",
      "CREATE INDEX IF NOT EXISTS trip_checklist_master_item_idx ON trip_checklist_items(master_item_id)",
      "CREATE UNIQUE INDEX IF NOT EXISTS trip_checklist_trip_master_unique_idx ON trip_checklist_items(trip_id,master_item_id) WHERE master_item_id IS NOT NULL",
    ],
  },
  {
    version: 11,
    statements: [
      `CREATE TABLE IF NOT EXISTS trip_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(trip_id,user_id)
      )`,
      "CREATE INDEX IF NOT EXISTS trip_reviews_trip_idx ON trip_reviews(trip_id,updated_at DESC)",
    ],
  },
  {
    version: 12,
    statements: [
      "ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_code CHAR(2)",
      "ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_name VARCHAR(120)",
      `UPDATE trips SET
        country_code=CASE
          WHEN lower(destination) LIKE '%japan%' OR destination LIKE '%ญี่ปุ่น%' OR timezone='Asia/Tokyo' THEN 'JP'
          WHEN lower(destination) LIKE '%china%' OR destination LIKE '%จีน%' OR timezone='Asia/Shanghai' THEN 'CN'
          WHEN lower(destination) LIKE '%korea%' OR destination LIKE '%เกาหลี%' OR timezone='Asia/Seoul' THEN 'KR'
          WHEN lower(destination) LIKE '%taiwan%' OR destination LIKE '%ไต้หวัน%' OR timezone='Asia/Taipei' THEN 'TW'
          WHEN lower(destination) LIKE '%hong kong%' OR destination LIKE '%ฮ่องกง%' OR timezone='Asia/Hong_Kong' THEN 'HK'
          WHEN lower(destination) LIKE '%singapore%' OR destination LIKE '%สิงคโปร์%' OR timezone='Asia/Singapore' THEN 'SG'
          WHEN lower(destination) LIKE '%vietnam%' OR destination LIKE '%เวียดนาม%' OR timezone='Asia/Ho_Chi_Minh' THEN 'VN'
          WHEN lower(destination) LIKE '%malaysia%' OR destination LIKE '%มาเลเซีย%' OR timezone='Asia/Kuala_Lumpur' THEN 'MY'
          WHEN lower(destination) LIKE '%indonesia%' OR destination LIKE '%อินโดนีเซีย%' OR timezone='Asia/Jakarta' THEN 'ID'
          WHEN lower(destination) LIKE '%thailand%' OR destination LIKE '%ไทย%' OR timezone='Asia/Bangkok' THEN 'TH'
          ELSE country_code END,
        country_name=CASE
          WHEN lower(destination) LIKE '%japan%' OR destination LIKE '%ญี่ปุ่น%' OR timezone='Asia/Tokyo' THEN 'Japan'
          WHEN lower(destination) LIKE '%china%' OR destination LIKE '%จีน%' OR timezone='Asia/Shanghai' THEN 'China'
          WHEN lower(destination) LIKE '%korea%' OR destination LIKE '%เกาหลี%' OR timezone='Asia/Seoul' THEN 'South Korea'
          WHEN lower(destination) LIKE '%taiwan%' OR destination LIKE '%ไต้หวัน%' OR timezone='Asia/Taipei' THEN 'Taiwan'
          WHEN lower(destination) LIKE '%hong kong%' OR destination LIKE '%ฮ่องกง%' OR timezone='Asia/Hong_Kong' THEN 'Hong Kong'
          WHEN lower(destination) LIKE '%singapore%' OR destination LIKE '%สิงคโปร์%' OR timezone='Asia/Singapore' THEN 'Singapore'
          WHEN lower(destination) LIKE '%vietnam%' OR destination LIKE '%เวียดนาม%' OR timezone='Asia/Ho_Chi_Minh' THEN 'Vietnam'
          WHEN lower(destination) LIKE '%malaysia%' OR destination LIKE '%มาเลเซีย%' OR timezone='Asia/Kuala_Lumpur' THEN 'Malaysia'
          WHEN lower(destination) LIKE '%indonesia%' OR destination LIKE '%อินโดนีเซีย%' OR timezone='Asia/Jakarta' THEN 'Indonesia'
          WHEN lower(destination) LIKE '%thailand%' OR destination LIKE '%ไทย%' OR timezone='Asia/Bangkok' THEN 'Thailand'
          ELSE country_name END
        WHERE country_code IS NULL OR country_name IS NULL`,
    ],
  },
  {
    version: 13,
    statements: [
      "ALTER TABLE trips ADD COLUMN IF NOT EXISTS has_flights BOOLEAN NOT NULL DEFAULT false",
      `CREATE TABLE IF NOT EXISTS trip_flight_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        journey_type VARCHAR(16) NOT NULL CHECK (journey_type IN ('outbound','return','internal')),
        segment_order INTEGER NOT NULL DEFAULT 0,
        airline_code VARCHAR(8) NOT NULL,
        airline_name VARCHAR(120) NOT NULL DEFAULT '',
        flight_number VARCHAR(16) NOT NULL,
        departure_airport_code VARCHAR(8) NOT NULL,
        departure_airport_name VARCHAR(160) NOT NULL DEFAULT '',
        arrival_airport_code VARCHAR(8) NOT NULL,
        arrival_airport_name VARCHAR(160) NOT NULL DEFAULT '',
        scheduled_departure_at TIMESTAMPTZ NOT NULL,
        scheduled_arrival_at TIMESTAMPTZ NOT NULL,
        latest_departure_at TIMESTAMPTZ,
        latest_arrival_at TIMESTAMPTZ,
        departure_terminal VARCHAR(24), departure_gate VARCHAR(24),
        arrival_terminal VARCHAR(24), arrival_gate VARCHAR(24),
        status VARCHAR(40) NOT NULL DEFAULT 'scheduled',
        booking_reference VARCHAR(80), cabin_class VARCHAR(80), baggage_note TEXT,
        provider VARCHAR(32), provider_flight_id VARCHAR(160), last_synced_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS trip_flight_passengers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        segment_id UUID NOT NULL REFERENCES trip_flight_segments(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seat_number VARCHAR(24), meal_preference VARCHAR(160), baggage_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(segment_id,user_id)
      )`,
      "ALTER TABLE trip_documents ADD COLUMN IF NOT EXISTS flight_segment_id UUID REFERENCES trip_flight_segments(id) ON DELETE SET NULL",
      "CREATE INDEX IF NOT EXISTS trip_flight_segments_trip_order_idx ON trip_flight_segments(trip_id,journey_type,segment_order,scheduled_departure_at)",
      "CREATE INDEX IF NOT EXISTS trip_flight_passengers_segment_idx ON trip_flight_passengers(segment_id)",
      "CREATE INDEX IF NOT EXISTS trip_documents_flight_segment_idx ON trip_documents(flight_segment_id)",
    ],
  },
  {
    version: 14,
    statements: [
      "ALTER TABLE trip_collaborators ADD COLUMN IF NOT EXISTS access_level VARCHAR(8) NOT NULL DEFAULT 'view'",
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='trip_collaborators_access_level_check') THEN
          ALTER TABLE trip_collaborators ADD CONSTRAINT trip_collaborators_access_level_check CHECK (access_level IN ('view','admin'));
        END IF;
      END $$`,
    ],
  },
  {
    version: 15,
    statements: [
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL",
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_cost_item_id UUID",
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(14,2)",
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_currency CHAR(3)",
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_exchange_rate NUMERIC(14,6)",
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_rate_date DATE",
      "CREATE INDEX IF NOT EXISTS trip_flight_segments_itinerary_idx ON trip_flight_segments(itinerary_id)",
    ],
  },
  {
    version: 16,
    statements: [
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS entered_departure_local TIMESTAMP",
      "ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS entered_arrival_local TIMESTAMP",
    ],
  },
  {
    version: 17,
    statements: [
      "CREATE INDEX IF NOT EXISTS trip_flight_segments_nearby_idx ON trip_flight_segments ((COALESCE(latest_departure_at,scheduled_departure_at)),last_synced_at)",
    ],
  },
  {
    version: 18,
    statements: [
      "ALTER TABLE trip_flight_passengers ADD COLUMN IF NOT EXISTS carry_on_baggage VARCHAR(160)",
      "ALTER TABLE trip_flight_passengers ADD COLUMN IF NOT EXISTS checked_baggage VARCHAR(160)",
      "UPDATE trip_flight_passengers SET checked_baggage=baggage_note WHERE checked_baggage IS NULL AND baggage_note IS NOT NULL",
    ],
  },
] as const;

let migrationPromise: Promise<void> | null = null;

async function migrate() {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bn-trip-schema-migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS app_schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    const applied = await client.query<{ version: number }>(
      "SELECT version FROM app_schema_migrations",
    );
    const appliedVersions = new Set(applied.rows.map(({ version }) => version));

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      for (const statement of migration.statements) await client.query(statement);
      await client.query(
        "INSERT INTO app_schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING",
        [migration.version],
      );
    }
  });
}

export function ensureLatestDatabaseSchema() {
  if (!migrationPromise) {
    migrationPromise = migrate().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}
