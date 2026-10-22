ALTER TABLE trip_expense_guests
  ADD COLUMN IF NOT EXISTS participant_type TEXT NOT NULL DEFAULT 'guest'
  CHECK (participant_type IN ('guest','member'));

ALTER TABLE trip_idea_expense_guests
  ADD COLUMN IF NOT EXISTS participant_type TEXT NOT NULL DEFAULT 'guest'
  CHECK (participant_type IN ('guest','member'));
