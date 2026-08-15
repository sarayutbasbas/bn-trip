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
