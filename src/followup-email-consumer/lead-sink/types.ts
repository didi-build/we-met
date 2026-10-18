import type {
  LeadSinkAppendDetailsMessage,
  LeadSinkRecordLeadMessage,
} from "@/exchange/queue/types";
import type { EmailProvider } from "@/email/email-provider";

export type ParsedLeadSinkRecordMessage = LeadSinkRecordLeadMessage;
export type ParsedLeadSinkAppendMessage = LeadSinkAppendDetailsMessage;

export type ParsedLeadSinkMessage =
  LeadSinkRecordLeadMessage | LeadSinkAppendDetailsMessage;

export type ParsedExternalRef = Record<string, string | number | boolean | null>;

export type LeadSinkHandlerContext = {
  messageAttempts: number;
  emailProvider: EmailProvider;
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
};
