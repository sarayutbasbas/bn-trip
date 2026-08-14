ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(320);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ALTER COLUMN shared_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx ON users(google_sub) WHERE google_sub IS NOT NULL;

UPDATE users SET email='sarayutkongpeng@gmail.com',updated_at=now()
WHERE id=(SELECT id FROM users WHERE shared_id='BNTOGETHER' OR id IN (SELECT owner_id FROM trips GROUP BY owner_id ORDER BY count(*) DESC LIMIT 1) ORDER BY (shared_id='BNTOGETHER') DESC LIMIT 1)
  AND email IS NULL;

CREATE TABLE IF NOT EXISTS trip_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id,email)
);
CREATE INDEX IF NOT EXISTS trip_collaborators_user_idx ON trip_collaborators(user_id);
CREATE INDEX IF NOT EXISTS trip_collaborators_email_idx ON trip_collaborators(lower(email));
