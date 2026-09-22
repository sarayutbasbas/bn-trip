ALTER TABLE trips ADD COLUMN IF NOT EXISTS summary_image_url TEXT;

CREATE INDEX IF NOT EXISTS trips_summary_image_idx
  ON trips(start_date DESC)
  WHERE summary_image_url IS NOT NULL;
