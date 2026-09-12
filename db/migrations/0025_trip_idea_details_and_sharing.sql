ALTER TABLE trip_ideas ADD COLUMN IF NOT EXISTS name VARCHAR(160);
UPDATE trip_ideas SET name=destination WHERE name IS NULL OR trim(name)='';
ALTER TABLE trip_ideas ALTER COLUMN name SET NOT NULL;
ALTER TABLE trip_ideas ADD COLUMN IF NOT EXISTS country_code CHAR(2);
ALTER TABLE trip_ideas ADD COLUMN IF NOT EXISTS trip_destinations JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS trip_idea_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_idea_id UUID NOT NULL REFERENCES trip_ideas(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_idea_id,email)
);

CREATE INDEX IF NOT EXISTS trip_idea_collaborators_user_idx ON trip_idea_collaborators(user_id);
CREATE INDEX IF NOT EXISTS trip_idea_collaborators_email_idx ON trip_idea_collaborators(lower(email));
