import type {
  CardEmailSnapshot,
  VisitorLead,
  VisitorLeadDetails,
} from "@/exchange/types";

export type VisitorFollowupQueueMessage = {
  type: "visitor_followup";
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
};

export type LeadSinkAppendDetailsMessage = {
  type: "lead_sink_append_details";
  sinkId: string;
  sinkKind: string;
  sinkConfig: unknown;
  lead: VisitorLead;
  details: VisitorLeadDetails;
  cardId: string;
  cardSlug: string;
};

export type WeMetQueueMessage =
  | VisitorFollowupQueueMessage
  | LeadSinkRecordLeadMessage
  | LeadSinkAppendDetailsMessage;
