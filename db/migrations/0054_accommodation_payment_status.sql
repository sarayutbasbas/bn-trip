ALTER TABLE trip_accommodations ADD COLUMN IF NOT EXISTS payment_status TEXT
  CHECK (payment_status IN ('paid', 'pending'));
