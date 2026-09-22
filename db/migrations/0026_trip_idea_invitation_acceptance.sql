-- Existing trip-idea shares predate the invitation flow. Move them back to a
-- pending state once so each recipient can explicitly accept or decline.
UPDATE trip_idea_collaborators
SET user_id = NULL
WHERE user_id IS NOT NULL;
