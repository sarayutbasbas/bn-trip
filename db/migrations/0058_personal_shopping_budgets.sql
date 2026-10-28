CREATE TABLE IF NOT EXISTS trip_personal_budgets (
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shopping_budget_thb NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (shopping_budget_thb >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(trip_id,user_id)
);
INSERT INTO trip_personal_budgets(trip_id,user_id,shopping_budget_thb)
SELECT id,owner_id,shopping_budget_thb FROM trips ON CONFLICT DO NOTHING;
