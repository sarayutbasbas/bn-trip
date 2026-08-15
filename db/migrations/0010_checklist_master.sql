CREATE TABLE IF NOT EXISTS checklist_master_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_master_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES checklist_master_categories(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_master_category_name_unique_idx ON checklist_master_categories(user_id,lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS checklist_master_item_title_unique_idx ON checklist_master_items(user_id,category_id,lower(title));
CREATE INDEX IF NOT EXISTS checklist_master_category_sort_idx ON checklist_master_categories(user_id,sort_order,created_at);
CREATE INDEX IF NOT EXISTS checklist_master_item_sort_idx ON checklist_master_items(user_id,category_id,sort_order,created_at);

ALTER TABLE trip_checklist_items ADD COLUMN IF NOT EXISTS master_item_id UUID REFERENCES checklist_master_items(id) ON DELETE SET NULL;
ALTER TABLE trip_checklist_items ADD COLUMN IF NOT EXISTS category_name VARCHAR(120) NOT NULL DEFAULT 'อื่น ๆ';
CREATE INDEX IF NOT EXISTS trip_checklist_master_item_idx ON trip_checklist_items(master_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS trip_checklist_trip_master_unique_idx ON trip_checklist_items(trip_id,master_item_id) WHERE master_item_id IS NOT NULL;
