/** Columns on lead_delivery_ledger (metadata only — no visitor PII or sink destinations). */
export const LEAD_DELIVERY_LEDGER_COLUMNS = [
  "id",
  "lead_id",
  "card_id",
  "sink_id",
  "sink_kind",
  "phase",
  "status",
  "error_code",
  "attempt_count",
  "next_attempt_at",
  "retry_until",
  "created_at",
  "updated_at",
  "sent_at",
  "gmail_message_id",
  "gmail_thread_id",
] as const;

export type LeadDeliveryLedgerColumn = (typeof LEAD_DELIVERY_LEDGER_COLUMNS)[number];
