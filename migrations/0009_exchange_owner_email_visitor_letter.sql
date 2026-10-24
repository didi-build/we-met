-- Per-exchange visitor letter send gate (metadata only; letter content travels in queue payloads).
ALTER TABLE exchange_owner_email ADD COLUMN visitor_letter_claimed_at TEXT;
ALTER TABLE exchange_owner_email ADD COLUMN visitor_letter_sent_at TEXT;
