ALTER TABLE trip_idea_collaborators ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'admin' CHECK (access_level IN ('view','admin'));
CREATE TABLE IF NOT EXISTS trip_idea_expense_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_idea_id UUID NOT NULL REFERENCES trip_ideas(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trip_idea_expense_guests_name_idx ON trip_idea_expense_guests(trip_idea_id,lower(name));
