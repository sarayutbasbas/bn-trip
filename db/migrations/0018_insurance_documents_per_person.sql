ALTER TABLE trip_travel_insurance_documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

WITH ranked_documents AS (
  SELECT trip_id, document_id,
    row_number() OVER (PARTITION BY trip_id ORDER BY created_at, document_id) AS position
  FROM trip_travel_insurance_documents
  WHERE user_id IS NULL
), ranked_passengers AS (
  SELECT trip_id, user_id,
    row_number() OVER (PARTITION BY trip_id ORDER BY created_at, user_id) AS position
  FROM trip_travel_insurance_passengers
)
UPDATE trip_travel_insurance_documents insurance_document
SET user_id = passenger.user_id
FROM ranked_documents document
JOIN ranked_passengers passenger USING (trip_id, position)
WHERE insurance_document.trip_id = document.trip_id
  AND insurance_document.document_id = document.document_id
  AND insurance_document.user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trip_travel_insurance_documents_user_unique_idx
  ON trip_travel_insurance_documents(trip_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trip_travel_insurance_documents_user_idx
  ON trip_travel_insurance_documents(user_id);
