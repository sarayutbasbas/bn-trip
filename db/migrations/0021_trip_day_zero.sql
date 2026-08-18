ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS has_day_zero BOOLEAN NOT NULL DEFAULT false;

-- Day 0 is the outbound travel day when the final outbound flight reaches the
-- destination on a later calendar date, or reaches it at/after 15:00 local time.
UPDATE trips trip
SET has_day_zero = COALESCE((
  SELECT
    final_flight.entered_arrival_local::date > trip.start_date
    OR (
      final_flight.entered_arrival_local::date = trip.start_date
      AND final_flight.entered_arrival_local::time >= TIME '15:00'
    )
  FROM trip_flight_segments final_flight
  WHERE final_flight.trip_id = trip.id
    AND final_flight.journey_type = 'outbound'
    AND final_flight.entered_arrival_local IS NOT NULL
  ORDER BY final_flight.segment_order DESC, final_flight.scheduled_departure_at DESC
  LIMIT 1
), false);
