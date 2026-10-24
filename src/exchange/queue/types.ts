import type {
  CardEmailSnapshot,
  LeadSinkAppendLead,
  VisitorLead,
  VisitorLeadDetails,
} from "@/exchange/types";

export type VisitorFollowupQueueMessage = {
  type: "visitor_followup";
  lead: VisitorLead;
  card: CardEmailSnapshot;
};

export type VisitorLetterDueMessage = {
  type: "visitor_letter_due";
  lead: VisitorLead;
  card: CardEmailSnapshot;
};

export type LeadSinkRecordLeadMessage = {
  type: "lead_sink_record";
  sinkId: string;
  sinkKind: string;
  sinkConfig: unknown;
  lead: VisitorLead;
  cardId: string;
  cardSlug: string;
  sourceUrl: string;
};

export type LeadSinkAppendDetailsMessage = {
  type: "lead_sink_append_details";
  sinkId: string;
  sinkKind: string;
  sinkConfig: unknown;
  lead: LeadSinkAppendLead;
  details: VisitorLeadDetails;
  cardId: string;
  cardSlug: string;
  sourceUrl: string;
  detailsSubmittedAt: string;
};

export type LeadSinkOwnerEmailMessage = {
  type: "lead_sink_owner_email";
  sinkId: string;
  sinkKind: string;
  sinkConfig: unknown;
  lead: VisitorLead;
  details: VisitorLeadDetails;
  cardId: string;
  cardSlug: string;
  sourceUrl: string;
  ownerFirstName?: string;
};

export type OwnerEmailDueMessage = {
  type: "owner_email_due";
  sinkId: string;
  sinkKind: string;
  sinkConfig: unknown;
  lead: VisitorLead;
  details: VisitorLeadDetails;
  cardId: string;
  cardSlug: string;
  sourceUrl: string;
  ownerFirstName?: string;
};

export type VisitorLetterQueueMessage =
  VisitorFollowupQueueMessage | VisitorLetterDueMessage;

export type WeMetQueueMessage =
  | VisitorLetterQueueMessage
  | LeadSinkRecordLeadMessage
  | LeadSinkAppendDetailsMessage
  | LeadSinkOwnerEmailMessage
  | OwnerEmailDueMessage;
