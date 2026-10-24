import type { VisitorLeadDetails } from "@/exchange/types";

export type ExchangeOwnerEmailStore = {
  ensurePending(input: {
    leadId: string;
    cardId: string;
    createdAt: string;
  }): Promise<void>;
  /**
   * Marks the exchange as finalized (details submit or dismiss). Returns false when
   * already finalized.
   */
  tryFinalize(input: {
    leadId: string;
    details: VisitorLeadDetails | null;
    finalizedAt: string;
  }): Promise<boolean>;
  hasFinalized(leadId: string): Promise<boolean>;
};
