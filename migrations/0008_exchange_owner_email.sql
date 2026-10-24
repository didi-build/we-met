-- Per-exchange owner email timing (metadata only; visitor details travel in queue payloads).
CREATE TABLE IF NOT EXISTS exchange_owner_email (
  lead_id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL,
  triggered_at TEXT,
  owner_email_claimed_at TEXT,
  owner_email_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exchange_owner_email_card_id ON exchange_owner_email (card_id);
