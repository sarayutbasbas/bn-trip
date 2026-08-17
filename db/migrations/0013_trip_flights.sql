ALTER TABLE trips ADD COLUMN IF NOT EXISTS has_flights BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS trip_flight_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  journey_type VARCHAR(16) NOT NULL CHECK (journey_type IN ('outbound','return','internal')), segment_order INTEGER NOT NULL DEFAULT 0,
  airline_code VARCHAR(8) NOT NULL, airline_name VARCHAR(120) NOT NULL DEFAULT '', flight_number VARCHAR(16) NOT NULL,
  departure_airport_code VARCHAR(8) NOT NULL, departure_airport_name VARCHAR(160) NOT NULL DEFAULT '',
  arrival_airport_code VARCHAR(8) NOT NULL, arrival_airport_name VARCHAR(160) NOT NULL DEFAULT '',
  scheduled_departure_at TIMESTAMPTZ NOT NULL, scheduled_arrival_at TIMESTAMPTZ NOT NULL,
  latest_departure_at TIMESTAMPTZ, latest_arrival_at TIMESTAMPTZ,
  departure_terminal VARCHAR(24), departure_gate VARCHAR(24), arrival_terminal VARCHAR(24), arrival_gate VARCHAR(24),
  status VARCHAR(40) NOT NULL DEFAULT 'scheduled', booking_reference VARCHAR(80), cabin_class VARCHAR(80), baggage_note TEXT,
  provider VARCHAR(32), provider_flight_id VARCHAR(160), last_synced_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trip_flight_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), segment_id UUID NOT NULL REFERENCES trip_flight_segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, seat_number VARCHAR(24), meal_preference VARCHAR(160), baggage_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(segment_id,user_id)
);
ALTER TABLE trip_documents ADD COLUMN IF NOT EXISTS flight_segment_id UUID REFERENCES trip_flight_segments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trip_flight_segments_trip_order_idx ON trip_flight_segments(trip_id,journey_type,segment_order,scheduled_departure_at);
CREATE INDEX IF NOT EXISTS trip_flight_passengers_segment_idx ON trip_flight_passengers(segment_id);
CREATE INDEX IF NOT EXISTS trip_documents_flight_segment_idx ON trip_documents(flight_segment_id);
