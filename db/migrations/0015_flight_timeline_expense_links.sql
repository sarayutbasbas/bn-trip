ALTER TABLE trip_flight_segments
  ADD COLUMN IF NOT EXISTS itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_cost_item_id UUID,
  ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS ticket_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS ticket_exchange_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS ticket_rate_date DATE;

CREATE INDEX IF NOT EXISTS trip_flight_segments_itinerary_idx
  ON trip_flight_segments(itinerary_id);
