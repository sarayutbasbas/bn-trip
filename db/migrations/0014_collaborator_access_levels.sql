ALTER TABLE trip_collaborators
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(8) NOT NULL DEFAULT 'view';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trip_collaborators_access_level_check'
  ) THEN
    ALTER TABLE trip_collaborators
      ADD CONSTRAINT trip_collaborators_access_level_check
      CHECK (access_level IN ('view', 'admin'));
  END IF;
END $$;
