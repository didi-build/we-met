export type LeadDeliveryPhase = "record" | "append";

export type LeadDeliveryStatus = "queued" | "sent" | "failed";

export type InsertQueuedLeadDeliveryInput = {
  id: string;
  leadId: string;
  cardId: string;
  sinkId: string;
  sinkKind: string;
  phase: LeadDeliveryPhase;
  retryUntil: string;
  createdAt: string;
};

export type LeadDeliveryLedger = {
  insertQueuedRow(input: InsertQueuedLeadDeliveryInput): Promise<void>;
  /**
   * Inserts phase=append when no row exists for (leadId, sinkId, append).
   * Returns whether a new row was created.
   */
  insertAppendIfAbsent(input: InsertQueuedLeadDeliveryInput): Promise<boolean>;
  markFailed(
    leadId: string,
    sinkId: string,
    phase: LeadDeliveryPhase,
    errorCode: string,
    updatedAt: string,
  ): Promise<void>;
};
