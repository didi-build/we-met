import type { VisitorLeadDetails } from "@/exchange/types";
import type { ExchangeOwnerEmailStore } from "@/exchange-owner-email/types";

type Row = {
  leadId: string;
  cardId: string;
  triggeredAt: string | null;
  details: VisitorLeadDetails | null;
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
      details: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });
  }

  async tryFinalize(input: {
    leadId: string;
    details: VisitorLeadDetails | null;
    finalizedAt: string;
  }): Promise<boolean> {
    const row = this.rows.get(input.leadId);
    if (!row || row.triggeredAt) {
      return false;
    }
    row.triggeredAt = input.finalizedAt;
    row.details = input.details;
    row.updatedAt = input.finalizedAt;
    return true;
  }

  async hasFinalized(leadId: string): Promise<boolean> {
    const row = this.rows.get(leadId);
    return Boolean(row?.triggeredAt);
  }
}
