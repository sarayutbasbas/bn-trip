CREATE TABLE IF NOT EXISTS collaborator_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,email)
);
CREATE INDEX IF NOT EXISTS collaborator_contacts_recent_idx ON collaborator_contacts(owner_user_id,last_used_at DESC);

INSERT INTO collaborator_contacts(owner_user_id,email,last_used_at)
SELECT invited_by,lower(email),max(created_at) FROM trip_collaborators GROUP BY invited_by,lower(email)
ON CONFLICT(owner_user_id,email) DO UPDATE SET last_used_at=GREATEST(collaborator_contacts.last_used_at,EXCLUDED.last_used_at);

ALTER TABLE users DROP COLUMN IF EXISTS shared_id;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
