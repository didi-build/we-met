import type {
  ExchangeOwnerEmailStore,
  OwnerEmailSendClaimResult,
  VisitorLetterSendClaimResult,
} from "@/exchange-owner-email/types";

type Row = {
  leadId: string;
  cardId: string;
  triggeredAt: string | null;
  ownerEmailClaimedAt: string | null;
  ownerEmailSentAt: string | null;
  visitorLetterClaimedAt: string | null;
  visitorLetterSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class MemoryExchangeOwnerEmailStore implements ExchangeOwnerEmailStore {
  readonly rows = new Map<string, Row>();

  async ensurePending(input: {
    leadId: string;
    cardId: string;
    createdAt: string;
  }): Promise<void> {
    if (this.rows.has(input.leadId)) {
      return;
    }
    this.rows.set(input.leadId, {
      leadId: input.leadId,
      cardId: input.cardId,
      triggeredAt: null,
      ownerEmailClaimedAt: null,
      ownerEmailSentAt: null,
      visitorLetterClaimedAt: null,
      visitorLetterSentAt: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });
  }

  async trySetTriggeredAt(input: {
    leadId: string;
    triggeredAt: string;
  }): Promise<boolean> {
    const row = this.rows.get(input.leadId);
    if (!row || row.triggeredAt) {
      return false;
    }
    row.triggeredAt = input.triggeredAt;
    row.updatedAt = input.triggeredAt;
    return true;
  }

  async hasTriggered(leadId: string): Promise<boolean> {
    const row = this.rows.get(leadId);
    return Boolean(row?.triggeredAt);
  }

  async getSendState(leadId: string) {
    const row = this.rows.get(leadId);
    if (!row) {
      return null;
    }
    return {
      triggeredAt: row.triggeredAt,
      ownerEmailSentAt: row.ownerEmailSentAt,
      visitorLetterSentAt: row.visitorLetterSentAt,
    };
  }

  async tryClaimOwnerEmailSend(
    leadId: string,
    claimedAt: string,
    staleBeforeIso: string,
  ): Promise<OwnerEmailSendClaimResult> {
    const row = this.rows.get(leadId);
    if (!row) {
      return "row_missing";
    }
    if (row.ownerEmailSentAt) {
      return "already_sent";
    }
    const claim = row.ownerEmailClaimedAt;
    if (claim && claim >= staleBeforeIso) {
      return "contention";
    }
    row.ownerEmailClaimedAt = claimedAt;
    row.updatedAt = claimedAt;
    return "claimed";
  }

  async confirmOwnerEmailSent(leadId: string, sentAt: string): Promise<void> {
    const row = this.rows.get(leadId);
    if (!row) {
      return;
    }
    row.ownerEmailSentAt = sentAt;
    row.ownerEmailClaimedAt = null;
    row.updatedAt = sentAt;
  }

  async releaseOwnerEmailSendClaim(leadId: string): Promise<void> {
    const row = this.rows.get(leadId);
    if (!row || row.ownerEmailSentAt) {
      return;
    }
    row.ownerEmailClaimedAt = null;
    row.updatedAt = new Date().toISOString();
  }

  async tryClaimVisitorLetterSend(
    leadId: string,
    claimedAt: string,
    staleBeforeIso: string,
  ): Promise<VisitorLetterSendClaimResult> {
    const row = this.rows.get(leadId);
    if (!row) {
      return "row_missing";
    }
    if (row.visitorLetterSentAt) {
      return "already_sent";
    }
    const claim = row.visitorLetterClaimedAt;
    if (claim && claim >= staleBeforeIso) {
      return "contention";
    }
    row.visitorLetterClaimedAt = claimedAt;
    row.updatedAt = claimedAt;
    return "claimed";
  }

  async confirmVisitorLetterSent(leadId: string, sentAt: string): Promise<void> {
    const row = this.rows.get(leadId);
    if (!row) {
      return;
    }
    row.visitorLetterSentAt = sentAt;
    row.visitorLetterClaimedAt = null;
    row.updatedAt = sentAt;
  }

  async releaseVisitorLetterSendClaim(leadId: string): Promise<void> {
    const row = this.rows.get(leadId);
    if (!row || row.visitorLetterSentAt) {
      return;
    }
    row.visitorLetterClaimedAt = null;
    row.updatedAt = new Date().toISOString();
  }
}
