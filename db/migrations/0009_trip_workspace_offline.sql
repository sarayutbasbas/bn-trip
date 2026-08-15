ALTER TABLE trips ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Bangkok';

CREATE TABLE IF NOT EXISTS trip_checklist_items (
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
);

CREATE TABLE IF NOT EXISTS trip_documents (
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
);

ALTER TABLE trip_documents ADD COLUMN IF NOT EXISTS blob_url TEXT;

CREATE TABLE IF NOT EXISTS trip_activity_logs (
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
);

CREATE INDEX IF NOT EXISTS trip_checklist_trip_sort_idx ON trip_checklist_items(trip_id,sort_order,created_at);
CREATE INDEX IF NOT EXISTS trip_documents_trip_created_idx ON trip_documents(trip_id,created_at DESC);
CREATE INDEX IF NOT EXISTS trip_activity_trip_created_idx ON trip_activity_logs(trip_id,created_at DESC);
