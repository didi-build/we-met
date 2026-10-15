import type { D1Database } from "@cloudflare/workers-types";
import type {
  InsertQueuedLeadDeliveryInput,
  LeadDeliveryLedger,
  LeadDeliveryPhase,
} from "@/lead-delivery-ledger/types";

export function createLeadDeliveryLedgerFromD1(db: D1Database): LeadDeliveryLedger {
  return {
    async insertQueuedRow(input: InsertQueuedLeadDeliveryInput): Promise<void> {
      await db
        .prepare(
          `INSERT INTO lead_delivery_ledger (
            id, lead_id, card_id, sink_id, sink_kind, phase, status,
            error_code, attempt_count, next_attempt_at, retry_until,
            created_at, updated_at, sent_at, gmail_message_id, gmail_thread_id
          ) VALUES (?, ?, ?, ?, ?, ?, 'queued', NULL, 0, NULL, ?, ?, ?, NULL, NULL, NULL)`,
        )
        .bind(
          input.id,
          input.leadId,
          input.cardId,
          input.sinkId,
          input.sinkKind,
          input.phase,
          input.retryUntil,
          input.createdAt,
          input.createdAt,
        )
        .run();
    },

    async insertAppendIfAbsent(input: InsertQueuedLeadDeliveryInput): Promise<boolean> {
      const result = await db
        .prepare(
          `INSERT INTO lead_delivery_ledger (
            id, lead_id, card_id, sink_id, sink_kind, phase, status,
            error_code, attempt_count, next_attempt_at, retry_until,
            created_at, updated_at, sent_at, gmail_message_id, gmail_thread_id
          ) VALUES (?, ?, ?, ?, ?, 'append', 'queued', NULL, 0, NULL, ?, ?, ?, NULL, NULL, NULL)
          ON CONFLICT(lead_id, sink_id, phase) DO NOTHING`,
        )
        .bind(
          input.id,
          input.leadId,
          input.cardId,
          input.sinkId,
          input.sinkKind,
          input.retryUntil,
          input.createdAt,
          input.createdAt,
        )
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async markFailed(
      leadId: string,
      sinkId: string,
      phase: LeadDeliveryPhase,
      errorCode: string,
      updatedAt: string,
    ): Promise<void> {
      await db
        .prepare(
          `UPDATE lead_delivery_ledger
           SET status = 'failed', error_code = ?, updated_at = ?
           WHERE lead_id = ? AND sink_id = ? AND phase = ?`,
        )
        .bind(errorCode, updatedAt, leadId, sinkId, phase)
        .run();
    },
  };
}
