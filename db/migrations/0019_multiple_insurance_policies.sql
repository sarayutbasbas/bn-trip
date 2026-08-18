CREATE TABLE IF NOT EXISTS trip_travel_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trip_travel_insurance(trip_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insured_name VARCHAR(180) NOT NULL,
  provider_name VARCHAR(160) NOT NULL,
  policy_number VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trip_travel_insurance_policies
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

INSERT INTO trip_travel_insurance_policies
  (trip_id,user_id,insured_name,provider_name,policy_number,created_at)
SELECT passenger.trip_id,passenger.user_id,
  COALESCE(NULLIF(trim(member.display_name),''),NULLIF(trim(member.email),''),'ผู้เอาประกัน'),
  passenger.provider_name,passenger.policy_number,passenger.created_at
FROM trip_travel_insurance_passengers passenger
JOIN users member ON member.id=passenger.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM trip_travel_insurance_policies policy
  WHERE policy.trip_id=passenger.trip_id AND policy.user_id=passenger.user_id
);

ALTER TABLE trip_travel_insurance_documents
  ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES trip_travel_insurance_policies(id) ON DELETE CASCADE;

UPDATE trip_travel_insurance_documents document
SET policy_id=(
  SELECT candidate.id FROM trip_travel_insurance_policies candidate
  WHERE candidate.trip_id=document.trip_id AND candidate.user_id=document.user_id
  ORDER BY candidate.created_at,candidate.id LIMIT 1
)
WHERE document.policy_id IS NULL AND document.user_id IS NOT NULL;

DROP INDEX IF EXISTS trip_travel_insurance_documents_user_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS trip_travel_insurance_documents_policy_unique_idx
  ON trip_travel_insurance_documents(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trip_travel_insurance_policies_trip_user_idx
  ON trip_travel_insurance_policies(trip_id,user_id,sort_order,created_at);
