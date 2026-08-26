CREATE TABLE IF NOT EXISTS trip_expense_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_expense_guests_trip_name_unique_idx
  ON trip_expense_guests(trip_id, lower(name));
CREATE INDEX IF NOT EXISTS trip_expense_guests_trip_created_idx
  ON trip_expense_guests(trip_id, created_at, id);
