ALTER TABLE trip_ideas
ADD COLUMN IF NOT EXISTS cover_image_url TEXT NOT NULL DEFAULT '/travel-postcard-fallback.jpg';
