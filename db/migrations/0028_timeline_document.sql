ALTER TABLE trip_documents
ADD COLUMN IF NOT EXISTS itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trip_documents_itinerary_idx
ON trip_documents(itinerary_id);
