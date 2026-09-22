ALTER TABLE trip_accommodations
ADD COLUMN IF NOT EXISTS night_bedtimes JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE trip_accommodations accommodation
SET night_bedtimes=COALESCE((
  SELECT jsonb_object_agg(
    stay_day.day_number::text,
    to_char(accommodation.bedtime,'HH24:MI')
  )
  FROM generate_series(
    accommodation.check_in_day,
    accommodation.check_out_day-1
  ) AS stay_day(day_number)
),'{}'::jsonb)
WHERE accommodation.night_bedtimes='{}'::jsonb;
