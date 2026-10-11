-- Cards, hostname routing, and lead sinks (step 1 schema).
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  variant TEXT NOT NULL CHECK (variant IN ('green', 'mono')),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_key TEXT,
  footer_link_json TEXT NOT NULL,
  page_copy_json TEXT NOT NULL,
  contact_json TEXT NOT NULL,
  exchange_copy_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hostnames (
  hostname TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_sinks (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  config_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_sinks_card_id ON lead_sinks (card_id);
