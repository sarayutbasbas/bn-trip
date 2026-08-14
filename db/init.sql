CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE time_slot AS ENUM ('morning','afternoon','evening'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE expense_type AS ENUM ('budget','actual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(320), google_sub TEXT, avatar_url TEXT,
  display_name VARCHAR(120) NOT NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'th', theme VARCHAR(12) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL, destination VARCHAR(160) NOT NULL, start_date DATE NOT NULL,
  total_days INTEGER NOT NULL CHECK (total_days BETWEEN 1 AND 90),
  traveller_count INTEGER NOT NULL DEFAULT 2 CHECK (traveller_count > 0),
  budget_thb NUMERIC(14,2) NOT NULL DEFAULT 0, shopping_budget_thb NUMERIC(14,2) NOT NULL DEFAULT 0,
  outbound_departure_at TIMESTAMP, return_departure_at TIMESTAMP,
  cover_image_url TEXT, google_photos_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx ON users(google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(trip_id,email)
);

CREATE TABLE IF NOT EXISTS collaborator_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL, last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_user_id,email)
);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS google_photos_url TEXT;

CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0), time_slot time_slot NOT NULL DEFAULT 'morning',
  start_time TIME, place_name VARCHAR(180), address TEXT, image_url TEXT,
  transport_mode VARCHAR(40), transport_note TEXT, cost_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(80) NOT NULL, brand VARCHAR(30), last_four CHAR(4), is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL, category VARCHAR(50) NOT NULL, expense_type expense_type NOT NULL DEFAULT 'actual',
  foreign_amount NUMERIC(14,2) NOT NULL, currency CHAR(3) NOT NULL,
  exchange_rate NUMERIC(14,6) NOT NULL, amount_thb NUMERIC(14,2) NOT NULL,
  payment_method VARCHAR(60) NOT NULL, credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  is_shopping BOOLEAN NOT NULL DEFAULT false, spent_at DATE NOT NULL,
  rate_stamped_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  airline VARCHAR(120), flight_number VARCHAR(20) NOT NULL, departure_airport CHAR(3) NOT NULL,
  arrival_airport CHAR(3) NOT NULL, departs_at TIMESTAMPTZ NOT NULL, arrives_at TIMESTAMPTZ NOT NULL,
  booking_reference VARCHAR(30), terminal VARCHAR(30), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lounges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  flight_id UUID REFERENCES flights(id) ON DELETE SET NULL, name VARCHAR(160) NOT NULL,
  airport_code CHAR(3) NOT NULL, terminal VARCHAR(40), access_method VARCHAR(120),
  visit_at TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_owner_idx ON trips(owner_id);
CREATE INDEX IF NOT EXISTS trip_collaborators_user_idx ON trip_collaborators(user_id);
CREATE INDEX IF NOT EXISTS trip_collaborators_email_idx ON trip_collaborators(lower(email));
CREATE INDEX IF NOT EXISTS collaborator_contacts_recent_idx ON collaborator_contacts(owner_user_id,last_used_at DESC);
CREATE INDEX IF NOT EXISTS itinerary_trip_day_idx ON itineraries(trip_id, day_number, sort_order);
CREATE INDEX IF NOT EXISTS expenses_trip_date_idx ON expenses(trip_id, spent_at);
CREATE INDEX IF NOT EXISTS flights_trip_idx ON flights(trip_id);

-- LOCAL_DEMO_SEED: the cloud setup script intentionally stops before this marker.
INSERT INTO users (email, display_name)
VALUES ('sarayutkongpeng@gmail.com', 'Sarayut Kongpeng')
ON CONFLICT DO NOTHING;
