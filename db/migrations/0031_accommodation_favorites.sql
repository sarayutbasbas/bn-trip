CREATE TABLE IF NOT EXISTS user_favorite_accommodations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accommodation_id UUID NOT NULL REFERENCES trip_accommodations(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, accommodation_id)
);

CREATE INDEX IF NOT EXISTS user_favorite_accommodations_recent_idx
  ON user_favorite_accommodations(user_id, favorited_at DESC);
