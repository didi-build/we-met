export type OwnerEmailSendClaimResult =
  "claimed" | "already_sent" | "contention" | "row_missing";

/** Stale claims older than this may be taken by another worker. */
export const OWNER_EMAIL_SEND_CLAIM_STALE_MS = 30 * 60 * 1000;

export type ExchangeOwnerEmailStore = {
  ensurePending(input: {
    leadId: string;
    cardId: string;
    createdAt: string;
  }): Promise<void>;
  /**
   * Records details submit or sheet dismiss (immediate enqueue trigger). Returns false when
   * already triggered.
   */
  trySetTriggeredAt(input: { leadId: string; triggeredAt: string }): Promise<boolean>;
  hasTriggered(leadId: string): Promise<boolean>;
  tryClaimOwnerEmailSend(
    leadId: string,
    claimedAt: string,
    staleBeforeIso: string,
  ): Promise<OwnerEmailSendClaimResult>;
  confirmOwnerEmailSent(leadId: string, sentAt: string): Promise<void>;
  releaseOwnerEmailSendClaim(leadId: string): Promise<void>;
};
