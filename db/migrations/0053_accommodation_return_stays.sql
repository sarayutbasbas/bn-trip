ALTER TABLE trip_accommodations ADD COLUMN IF NOT EXISTS hotel_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE trip_accommodations ADD COLUMN IF NOT EXISTS breakfast_days INTEGER[];
