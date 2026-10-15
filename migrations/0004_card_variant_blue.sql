-- Expand cards.variant CHECK to allow blue (card redesign palettes).
PRAGMA foreign_keys = OFF;

CREATE TABLE cards_new (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  variant TEXT NOT NULL CHECK (variant IN ('green', 'mono', 'blue')),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_key TEXT,
  links_json TEXT NOT NULL,
  page_copy_json TEXT NOT NULL,
  contact_json TEXT NOT NULL,
  copy_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO cards_new (
  id,
  slug,
  variant,
  display_name,
  email,
  photo_key,
  links_json,
  page_copy_json,
  contact_json,
  copy_json,
  updated_at
)
SELECT
  id,
  slug,
  variant,
  display_name,
  email,
  photo_key,
  links_json,
  page_copy_json,
  contact_json,
  copy_json,
  updated_at
FROM cards;

DROP TABLE cards;

ALTER TABLE cards_new RENAME TO cards;

PRAGMA foreign_keys = ON;
