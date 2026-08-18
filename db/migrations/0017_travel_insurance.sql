CREATE TABLE IF NOT EXISTS trip_travel_insurance (
  trip_id UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  provider_name VARCHAR(160) NOT NULL,
  policy_number VARCHAR(120) NOT NULL,
  emergency_phone VARCHAR(80),
  document_id UUID REFERENCES trip_documents(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_travel_insurance_passengers (
  trip_id UUID NOT NULL REFERENCES trip_travel_insurance(trip_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name VARCHAR(160) NOT NULL,
  policy_number VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id,user_id)
);

CREATE TABLE IF NOT EXISTS trip_travel_insurance_documents (
  trip_id UUID NOT NULL REFERENCES trip_travel_insurance(trip_id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES trip_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id,document_id)
);

CREATE INDEX IF NOT EXISTS trip_travel_insurance_document_idx
  ON trip_travel_insurance(document_id);

CREATE INDEX IF NOT EXISTS trip_travel_insurance_passenger_user_idx
  ON trip_travel_insurance_passengers(user_id);

CREATE INDEX IF NOT EXISTS trip_travel_insurance_documents_document_idx
  ON trip_travel_insurance_documents(document_id);
