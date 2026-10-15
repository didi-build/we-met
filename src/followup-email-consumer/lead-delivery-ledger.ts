import type { D1Database } from "@cloudflare/workers-types";

export type LeadDeliveryPhase = "record" | "append";

export type LeadDeliveryLedgerRow = {
  status: "queued" | "sent" | "failed";
  externalRef: string | null;
};

export type ConsumerLeadDeliveryLedger = {
  findRow(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
  ): Promise<LeadDeliveryLedgerRow | null>;
  markSent(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    sentAt: string;
    externalRef: string | null;
  }): Promise<boolean>;
  recordFailedAttempt(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    attemptCount: number;
    nextAttemptAt: string;
    updatedAt: string;
  }): Promise<boolean>;
  markFailed(input: {
    leadId: string;
    sinkId: string;
    phase: LeadDeliveryPhase;
    errorCode: string;
    updatedAt: string;
  }): Promise<boolean>;
};

export function createConsumerLeadDeliveryLedger(
  db: D1Database,
): ConsumerLeadDeliveryLedger {
  return {
    async findRow(leadId, sinkId, phase) {
      const row = await db
        .prepare(
          `SELECT status, external_ref
           FROM lead_delivery_ledger
           WHERE lead_id = ? AND sink_id = ? AND phase = ?`,
        )
        .bind(leadId, sinkId, phase)
        .first<{
          status: string;
          external_ref: string | null;
        }>();
      if (!row) {
        return null;
      }
      if (row.status !== "queued" && row.status !== "sent" && row.status !== "failed") {
        return null;
      }
      return {
        status: row.status,
        externalRef: row.external_ref,
      };
    },

    async markSent(input) {
      const result = await db
        .prepare(
          `UPDATE lead_delivery_ledger
           SET status = 'sent',
               sent_at = ?,
               external_ref = ?,
               updated_at = ?,
               error_code = NULL,
               next_attempt_at = NULL
           WHERE lead_id = ? AND sink_id = ? AND phase = ? AND status = 'queued'`,
        )
        .bind(
          input.sentAt,
          input.externalRef,
          input.sentAt,
          input.leadId,
          input.sinkId,
          input.phase,
        )
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async recordFailedAttempt(input) {
      const result = await db
        .prepare(
          `UPDATE lead_delivery_ledger
           SET attempt_count = ?,
               next_attempt_at = ?,
               updated_at = ?
           WHERE lead_id = ? AND sink_id = ? AND phase = ? AND status = 'queued'`,
        )
        .bind(
          input.attemptCount,
          input.nextAttemptAt,
          input.updatedAt,
          input.leadId,
          input.sinkId,
          input.phase,
        )
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async markFailed(input) {
      const result = await db
        .prepare(
          `UPDATE lead_delivery_ledger
           SET status = 'failed',
               error_code = ?,
               updated_at = ?,
               next_attempt_at = NULL
           WHERE lead_id = ? AND sink_id = ? AND phase = ? AND status = 'queued'`,
        )
        .bind(input.errorCode, input.updatedAt, input.leadId, input.sinkId, input.phase)
        .run();
      return (result.meta.changes ?? 0) > 0;
    },
  };
}
