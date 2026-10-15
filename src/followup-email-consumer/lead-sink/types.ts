import type {
  LeadSinkAppendDetailsMessage,
  LeadSinkRecordLeadMessage,
} from "@/exchange/queue/types";

export type ParsedLeadSinkRecordMessage = LeadSinkRecordLeadMessage;
export type ParsedLeadSinkAppendMessage = LeadSinkAppendDetailsMessage;

export type ParsedLeadSinkMessage =
  ParsedLeadSinkRecordMessage | ParsedLeadSinkAppendMessage;

export type LeadSinkHandlerContext = {
  messageAttempts: number;
};

export type LeadSinkHandler = {
  handleRecord(
    message: ParsedLeadSinkRecordMessage,
    ctx: LeadSinkHandlerContext,
  ): Promise<void>;
  handleAppend(
    message: ParsedLeadSinkAppendMessage,
    ctx: LeadSinkHandlerContext,
  ): Promise<void>;
};
