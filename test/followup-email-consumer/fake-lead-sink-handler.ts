import type {
  LeadSinkAppendContext,
  LeadSinkHandler,
  ParsedLeadSinkAppendMessage,
  ParsedLeadSinkRecordMessage,
} from "@/followup-email-consumer/lead-sink/types";

export type FakeLeadSinkHandlerOptions = {
  appendRequiresRecord?: boolean;
  recordRef?: string | null;
  onRecord?: (message: ParsedLeadSinkRecordMessage) => void;
  onAppend?: (message: ParsedLeadSinkAppendMessage, ctx: LeadSinkAppendContext) => void;
  deliverRecord?: () => Promise<{ externalRef: string | null }>;
  deliverAppend?: () => Promise<{ externalRef: string | null }>;
};

export function createFakeLeadSinkHandler(
  options: FakeLeadSinkHandlerOptions = {},
): LeadSinkHandler {
  const recordRef =
    options.recordRef === undefined
      ? JSON.stringify({ fakeId: "rec-1" })
      : options.recordRef;

  return {
    appendRequiresRecord: options.appendRequiresRecord ?? true,
    async deliverRecord(message) {
      options.onRecord?.(message);
      if (options.deliverRecord) {
        return options.deliverRecord();
      }
      return { externalRef: recordRef };
    },
    async deliverAppend(message, ctx) {
      options.onAppend?.(message, ctx);
      if (options.deliverAppend) {
        return options.deliverAppend();
      }
      return { externalRef: null };
    },
  };
}
