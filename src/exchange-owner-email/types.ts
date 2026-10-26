export type OwnerEmailSendClaimResult =
  "claimed" | "already_sent" | "contention" | "row_missing";

export type VisitorLetterSendClaimResult = OwnerEmailSendClaimResult;

/** Stale claims older than this may be taken by another worker. */
export const OWNER_EMAIL_SEND_CLAIM_STALE_MS = 30 * 60 * 1000;

export const VISITOR_LETTER_SEND_CLAIM_STALE_MS = OWNER_EMAIL_SEND_CLAIM_STALE_MS;

export type ExchangeOwnerEmailSendState = {
  cardId: string;
  triggeredAt: string | null;
  ownerEmailSentAt: string | null;
  visitorLetterSentAt: string | null;
};

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
  getSendState(leadId: string): Promise<ExchangeOwnerEmailSendState | null>;
  tryClaimOwnerEmailSend(
    leadId: string,
    claimedAt: string,
    staleBeforeIso: string,
  ): Promise<OwnerEmailSendClaimResult>;
  confirmOwnerEmailSent(leadId: string, sentAt: string): Promise<void>;
  releaseOwnerEmailSendClaim(leadId: string): Promise<void>;
  tryClaimVisitorLetterSend(
    leadId: string,
    claimedAt: string,
    staleBeforeIso: string,
  ): Promise<VisitorLetterSendClaimResult>;
  confirmVisitorLetterSent(leadId: string, sentAt: string): Promise<void>;
  releaseVisitorLetterSendClaim(leadId: string): Promise<void>;
};
