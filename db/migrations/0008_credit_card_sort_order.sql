ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS credit_cards_user_sort_idx
  ON credit_cards(user_id,sort_order,created_at DESC);
