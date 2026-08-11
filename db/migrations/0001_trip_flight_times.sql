ALTER TABLE trips ADD COLUMN IF NOT EXISTS outbound_departure_at TIMESTAMP;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS return_departure_at TIMESTAMP;

UPDATE trips
SET outbound_departure_at = start_date::timestamp,
    return_departure_at = (start_date + (GREATEST(total_days, 1) - 1))::timestamp
WHERE outbound_departure_at IS NULL OR return_departure_at IS NULL;
