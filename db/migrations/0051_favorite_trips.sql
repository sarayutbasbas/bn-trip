CREATE TABLE IF NOT EXISTS user_favorite_trips (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_id)
);

CREATE TABLE IF NOT EXISTS user_favorite_trip_ideas (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_idea_id UUID NOT NULL REFERENCES trip_ideas(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_idea_id)
);
