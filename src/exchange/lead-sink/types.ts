import type { VisitorLead, VisitorLeadDetails } from "@/exchange/types";

export type LeadSinkRecordRef = {
  sinkId: string;
  externalId: string;
};

export type LeadSinkContext = {
  environment: string;
  cardId: string;
  cardSlug: string;
};

export interface LeadSink {
  readonly kind: string;
  recordLead(
    ctx: LeadSinkContext,
    lead: VisitorLead,
    config: unknown,
  ): Promise<LeadSinkRecordRef>;
  appendDetails(
    ctx: LeadSinkContext,
    ref: LeadSinkRecordRef,
    details: VisitorLeadDetails,
    config: unknown,
  ): Promise<void>;
  noteDeliveryFailure(
    ctx: LeadSinkContext,
    ref: LeadSinkRecordRef,
    reason: string,
    config: unknown,
  ): Promise<void>;
}
