CREATE TABLE IF NOT EXISTS trip_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination VARCHAR(160) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('planned','someday')),
  target_month INTEGER CHECK (target_month BETWEEN 1 AND 12),
  target_year INTEGER CHECK (target_year BETWEEN 2020 AND 2200),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind='planned' AND target_month IS NOT NULL AND target_year IS NOT NULL) OR (kind='someday' AND target_month IS NULL AND target_year IS NULL))
);

CREATE INDEX IF NOT EXISTS trip_ideas_user_schedule_idx ON trip_ideas(user_id,kind,target_year,target_month,created_at);
