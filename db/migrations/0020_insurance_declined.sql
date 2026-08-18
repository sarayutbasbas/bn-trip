ALTER TABLE trip_travel_insurance_passengers
  ADD COLUMN IF NOT EXISTS declined_insurance BOOLEAN NOT NULL DEFAULT false;
