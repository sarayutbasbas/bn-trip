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
  cover_image_url TEXT, google_photos_url TEXT, timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Bangkok',
  country_code CHAR(2), country_name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx ON users(google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level VARCHAR(8) NOT NULL DEFAULT 'view' CHECK (access_level IN ('view','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(trip_id,email)
);

CREATE TABLE IF NOT EXISTS collaborator_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL, last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(owner_user_id,email)
);

ALTER TABLE trips ADD COLUMN IF NOT EXISTS google_photos_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Bangkok';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS has_flights BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_code CHAR(2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_name VARCHAR(120);
ALTER TABLE trip_collaborators ADD COLUMN IF NOT EXISTS access_level VARCHAR(8) NOT NULL DEFAULT 'view';

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
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

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

CREATE TABLE IF NOT EXISTS trip_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL, assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ, completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0, created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_master_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_master_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES checklist_master_categories(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_master_category_name_unique_idx ON checklist_master_categories(user_id,lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS checklist_master_item_title_unique_idx ON checklist_master_items(user_id,category_id,lower(title));
CREATE INDEX IF NOT EXISTS checklist_master_category_sort_idx ON checklist_master_categories(user_id,sort_order,created_at);
CREATE INDEX IF NOT EXISTS checklist_master_item_sort_idx ON checklist_master_items(user_id,category_id,sort_order,created_at);
ALTER TABLE trip_checklist_items ADD COLUMN IF NOT EXISTS master_item_id UUID REFERENCES checklist_master_items(id) ON DELETE SET NULL;
ALTER TABLE trip_checklist_items ADD COLUMN IF NOT EXISTS category_name VARCHAR(120) NOT NULL DEFAULT 'อื่น ๆ';
CREATE INDEX IF NOT EXISTS trip_checklist_master_item_idx ON trip_checklist_items(master_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS trip_checklist_trip_master_unique_idx ON trip_checklist_items(trip_id,master_item_id) WHERE master_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS trip_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL, stored_filename TEXT NOT NULL, blob_url TEXT, original_filename TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL, file_size BIGINT NOT NULL CHECK (file_size >= 0),
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trip_documents ADD COLUMN IF NOT EXISTS blob_url TEXT;

CREATE TABLE IF NOT EXISTS trip_flight_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  journey_type VARCHAR(16) NOT NULL CHECK (journey_type IN ('outbound','return','internal')), segment_order INTEGER NOT NULL DEFAULT 0,
  airline_code VARCHAR(8) NOT NULL, airline_name VARCHAR(120) NOT NULL DEFAULT '', flight_number VARCHAR(16) NOT NULL,
  departure_airport_code VARCHAR(8) NOT NULL, departure_airport_name VARCHAR(160) NOT NULL DEFAULT '', arrival_airport_code VARCHAR(8) NOT NULL, arrival_airport_name VARCHAR(160) NOT NULL DEFAULT '',
  scheduled_departure_at TIMESTAMPTZ NOT NULL, scheduled_arrival_at TIMESTAMPTZ NOT NULL, latest_departure_at TIMESTAMPTZ, latest_arrival_at TIMESTAMPTZ,
  entered_departure_local TIMESTAMP, entered_arrival_local TIMESTAMP,
  departure_terminal VARCHAR(24), departure_gate VARCHAR(24), arrival_terminal VARCHAR(24), arrival_gate VARCHAR(24), status VARCHAR(40) NOT NULL DEFAULT 'scheduled',
  booking_reference VARCHAR(80), cabin_class VARCHAR(80), baggage_note TEXT, provider VARCHAR(32), provider_flight_id VARCHAR(160), last_synced_at TIMESTAMPTZ,
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL, ticket_cost_item_id UUID,
  ticket_price NUMERIC(14,2), ticket_currency CHAR(3), ticket_exchange_rate NUMERIC(14,6), ticket_rate_date DATE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trip_flight_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), segment_id UUID NOT NULL REFERENCES trip_flight_segments(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_number VARCHAR(24), meal_preference VARCHAR(160), baggage_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(segment_id,user_id)
);
ALTER TABLE trip_documents ADD COLUMN IF NOT EXISTS flight_segment_id UUID REFERENCES trip_flight_segments(id) ON DELETE SET NULL;
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL;
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_cost_item_id UUID;
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(14,2);
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_currency CHAR(3);
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_exchange_rate NUMERIC(14,6);
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS ticket_rate_date DATE;
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS entered_departure_local TIMESTAMP;
ALTER TABLE trip_flight_segments ADD COLUMN IF NOT EXISTS entered_arrival_local TIMESTAMP;

CREATE TABLE IF NOT EXISTS trip_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL, entity_type VARCHAR(40) NOT NULL,
  entity_id UUID, action VARCHAR(20) NOT NULL, summary TEXT NOT NULL, before_data JSONB, after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), undone_at TIMESTAMPTZ, undone_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS trips_owner_idx ON trips(owner_id);
CREATE INDEX IF NOT EXISTS trip_collaborators_user_idx ON trip_collaborators(user_id);
CREATE INDEX IF NOT EXISTS trip_collaborators_email_idx ON trip_collaborators(lower(email));
CREATE INDEX IF NOT EXISTS collaborator_contacts_recent_idx ON collaborator_contacts(owner_user_id,last_used_at DESC);
CREATE INDEX IF NOT EXISTS credit_cards_user_sort_idx ON credit_cards(user_id,sort_order,created_at DESC);
CREATE INDEX IF NOT EXISTS itinerary_trip_day_idx ON itineraries(trip_id, day_number, sort_order);
CREATE INDEX IF NOT EXISTS expenses_trip_date_idx ON expenses(trip_id, spent_at);
CREATE INDEX IF NOT EXISTS flights_trip_idx ON flights(trip_id);
CREATE INDEX IF NOT EXISTS trip_flight_segments_itinerary_idx ON trip_flight_segments(itinerary_id);
CREATE INDEX IF NOT EXISTS trip_checklist_trip_sort_idx ON trip_checklist_items(trip_id,sort_order,created_at);
CREATE INDEX IF NOT EXISTS trip_documents_trip_created_idx ON trip_documents(trip_id,created_at DESC);
CREATE INDEX IF NOT EXISTS trip_activity_trip_created_idx ON trip_activity_logs(trip_id,created_at DESC);

CREATE TABLE IF NOT EXISTS trip_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5), review TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id,user_id)
);
CREATE INDEX IF NOT EXISTS trip_reviews_trip_idx ON trip_reviews(trip_id,updated_at DESC);

-- LOCAL_DEMO_SEED: the cloud setup script intentionally stops before this marker.
INSERT INTO users (email, display_name)
VALUES ('sarayutkongpeng@gmail.com', 'Sarayut Kongpeng')
ON CONFLICT DO NOTHING;
