-- Contacts setup (DIDI-747): persist completion only; no Google tokens.

ALTER TABLE accounts ADD COLUMN contact_added_at TEXT;
ALTER TABLE accounts ADD COLUMN contact_sender_addresses TEXT;

CREATE TABLE IF NOT EXISTS contacts_oauth_attempts (
  state_hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  pkce_verifier TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_oauth_attempts_account_id
  ON contacts_oauth_attempts (account_id);
