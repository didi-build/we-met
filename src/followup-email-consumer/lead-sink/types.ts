import type {
  LeadSinkAppendDetailsMessage,
  LeadSinkOwnerEmailMessage,
  LeadSinkRecordLeadMessage,
} from "@/exchange/queue/types";
export type ParsedLeadSinkRecordMessage = LeadSinkRecordLeadMessage;
export type ParsedLeadSinkAppendMessage = LeadSinkAppendDetailsMessage;

export type ParsedLeadSinkOwnerEmailMessage =
  LeadSinkOwnerEmailMessage | import("@/exchange/queue/types").OwnerEmailDueMessage;

export type ParsedLeadSinkMessage =
  | LeadSinkRecordLeadMessage
  | LeadSinkAppendDetailsMessage
  | ParsedLeadSinkOwnerEmailMessage;

export type ParsedExternalRef = Record<string, string | number | boolean | null>;

export type LeadSinkHandlerContext = {
  messageAttempts: number;
};

export type LeadSinkAppendContext = LeadSinkHandlerContext & {
  recordRef: ParsedExternalRef | null;
};

export type LeadSinkDeliveryResult = {
  externalRef: string | null;
};

export type LeadSinkHandler = {
  appendRequiresRecord: boolean;
  deliverRecord(
    message: ParsedLeadSinkRecordMessage,
    ctx: LeadSinkHandlerContext,
  ): Promise<LeadSinkDeliveryResult>;
  deliverAppend(
    message: ParsedLeadSinkAppendMessage,
    ctx: LeadSinkAppendContext,
  ): Promise<LeadSinkDeliveryResult>;
  deliverOwnerEmail(
    message: ParsedLeadSinkOwnerEmailMessage,
    ctx: LeadSinkHandlerContext,
  ): Promise<LeadSinkDeliveryResult>;
};
