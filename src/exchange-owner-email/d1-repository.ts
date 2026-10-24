import type { D1Database } from "@cloudflare/workers-types";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";

export function createExchangeOwnerEmailStoreFromD1(
  db: D1Database,
): ExchangeOwnerEmailStore {
  return {
    async ensurePending(input) {
      await db
        .prepare(
          `INSERT INTO exchange_owner_email (lead_id, card_id, triggered_at, owner_email_claimed_at, owner_email_sent_at, visitor_letter_claimed_at, visitor_letter_sent_at, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)
           ON CONFLICT(lead_id) DO NOTHING`,
        )
        .bind(input.leadId, input.cardId, input.createdAt, input.createdAt)
        .run();
    },

    async trySetTriggeredAt(input) {
      const result = await db
        .prepare(
          `UPDATE exchange_owner_email
           SET triggered_at = ?,
               updated_at = ?
           WHERE lead_id = ? AND triggered_at IS NULL`,
        )
        .bind(input.triggeredAt, input.triggeredAt, input.leadId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    async hasTriggered(leadId) {
      const row = await db
        .prepare(
          `SELECT triggered_at FROM exchange_owner_email WHERE lead_id = ? LIMIT 1`,
        )
        .bind(leadId)
        .first<{ triggered_at: string | null }>();
      return Boolean(row?.triggered_at);
    },

    async getSendState(leadId) {
      const row = await db
        .prepare(
          `SELECT triggered_at, owner_email_sent_at, visitor_letter_sent_at
           FROM exchange_owner_email
           WHERE lead_id = ?
           LIMIT 1`,
        )
        .bind(leadId)
        .first<{
          triggered_at: string | null;
          owner_email_sent_at: string | null;
          visitor_letter_sent_at: string | null;
        }>();
      if (!row) {
        return null;
      }
      return {
        triggeredAt: row.triggered_at,
        ownerEmailSentAt: row.owner_email_sent_at,
        visitorLetterSentAt: row.visitor_letter_sent_at,
      };
    },

    async tryClaimOwnerEmailSend(leadId, claimedAt, staleBeforeIso) {
      const result = await db
        .prepare(
          `UPDATE exchange_owner_email
           SET owner_email_claimed_at = ?,
               updated_at = ?
           WHERE lead_id = ?
             AND owner_email_sent_at IS NULL
             AND (
               owner_email_claimed_at IS NULL
               OR owner_email_claimed_at < ?
             )`,
        )
        .bind(claimedAt, claimedAt, leadId, staleBeforeIso)
        .run();
      if ((result.meta.changes ?? 0) > 0) {
        return "claimed";
      }

      const row = await db
        .prepare(
          `SELECT owner_email_sent_at, owner_email_claimed_at
           FROM exchange_owner_email
           WHERE lead_id = ?
           LIMIT 1`,
        )
        .bind(leadId)
        .first<{
          owner_email_sent_at: string | null;
          owner_email_claimed_at: string | null;
        }>();
      if (!row) {
        return "row_missing";
      }
      if (row.owner_email_sent_at) {
        return "already_sent";
      }
      return "contention";
    },

    async confirmOwnerEmailSent(leadId, sentAt) {
      await db
        .prepare(
          `UPDATE exchange_owner_email
           SET owner_email_sent_at = ?,
               owner_email_claimed_at = NULL,
               updated_at = ?
           WHERE lead_id = ?`,
        )
        .bind(sentAt, sentAt, leadId)
        .run();
    },

    async releaseOwnerEmailSendClaim(leadId) {
      await db
        .prepare(
          `UPDATE exchange_owner_email
           SET owner_email_claimed_at = NULL,
               updated_at = ?
           WHERE lead_id = ?
             AND owner_email_sent_at IS NULL`,
        )
        .bind(new Date().toISOString(), leadId)
        .run();
    },

    async tryClaimVisitorLetterSend(leadId, claimedAt, staleBeforeIso) {
      const result = await db
        .prepare(
          `UPDATE exchange_owner_email
           SET visitor_letter_claimed_at = ?,
               updated_at = ?
           WHERE lead_id = ?
             AND visitor_letter_sent_at IS NULL
             AND (
               visitor_letter_claimed_at IS NULL
               OR visitor_letter_claimed_at < ?
             )`,
        )
        .bind(claimedAt, claimedAt, leadId, staleBeforeIso)
        .run();
      if ((result.meta.changes ?? 0) > 0) {
        return "claimed";
      }

      const row = await db
        .prepare(
          `SELECT visitor_letter_sent_at, visitor_letter_claimed_at
           FROM exchange_owner_email
           WHERE lead_id = ?
           LIMIT 1`,
        )
        .bind(leadId)
        .first<{
          visitor_letter_sent_at: string | null;
          visitor_letter_claimed_at: string | null;
        }>();
      if (!row) {
        return "row_missing";
      }
      if (row.visitor_letter_sent_at) {
        return "already_sent";
      }
      return "contention";
    },

    async confirmVisitorLetterSent(leadId, sentAt) {
      await db
        .prepare(
          `UPDATE exchange_owner_email
           SET visitor_letter_sent_at = ?,
               visitor_letter_claimed_at = NULL,
               updated_at = ?
           WHERE lead_id = ?`,
        )
        .bind(sentAt, sentAt, leadId)
        .run();
    },

    async releaseVisitorLetterSendClaim(leadId) {
      await db
        .prepare(
          `UPDATE exchange_owner_email
           SET visitor_letter_claimed_at = NULL,
               updated_at = ?
           WHERE lead_id = ?
             AND visitor_letter_sent_at IS NULL`,
        )
        .bind(new Date().toISOString(), leadId)
        .run();
    },
  };
}
