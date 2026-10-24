import type { D1Database } from "@cloudflare/workers-types";
import type { VisitorLeadDetails } from "@/exchange/types";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";

function serializeDetails(details: VisitorLeadDetails | null): string | null {
  if (!details) {
    return null;
  }
  return JSON.stringify(details);
}

export function createExchangeOwnerEmailStoreFromD1(
  db: D1Database,
): ExchangeOwnerEmailStore {
  return {
    async ensurePending(input) {
      await db
        .prepare(
          `INSERT INTO exchange_owner_email (lead_id, card_id, triggered_at, details_json, owner_email_sent_at, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, NULL, ?, ?)
           ON CONFLICT(lead_id) DO NOTHING`,
        )
        .bind(input.leadId, input.cardId, input.createdAt, input.createdAt)
        .run();
    },

    async tryFinalize(input) {
      const result = await db
        .prepare(
          `UPDATE exchange_owner_email
           SET triggered_at = ?,
               details_json = COALESCE(?, details_json),
               updated_at = ?
           WHERE lead_id = ? AND triggered_at IS NULL`,
        )
        .bind(
          input.finalizedAt,
          serializeDetails(input.details),
          input.finalizedAt,
          input.leadId,
        )
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async hasFinalized(leadId) {
      const row = await db
        .prepare(
          `SELECT triggered_at FROM exchange_owner_email WHERE lead_id = ? LIMIT 1`,
        )
        .bind(leadId)
        .first<{ triggered_at: string | null }>();
      return Boolean(row?.triggered_at);
    },
  };
}
