ALTER TABLE trip_flight_segments
  ADD COLUMN IF NOT EXISTS entered_departure_local TIMESTAMP,
  ADD COLUMN IF NOT EXISTS entered_arrival_local TIMESTAMP;
