import { describe, expect, it, vi } from "vitest";
import {
  processFollowupQueueBatch,
  type FollowupQueueMessage,
} from "@/followup-email-consumer/process-batch";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";
import { createLeadSinkHandlerRegistry } from "@/followup-email-consumer/lead-sink/registry";
import { MemoryConsumerLeadDeliveryLedger } from "./memory-consumer-ledger";
import { leadEmailConsumerEnabled } from "../helpers/lead-email-deps";

function createMessage(body: unknown): FollowupQueueMessage {
  return {
    id: "msg-1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe("lead email kill switch in consumer (unit)", () => {
  it("drops visitor follow-up without send or retry when paused", async () => {
    const send = vi.fn();
    const message = createMessage({
      type: "visitor_followup",
      lead: {
        leadId: "lead-1",
        submittedAt: "2026-10-12T00:00:00.000Z",
        environment: "preview",
        isTestLead: true,
        name: "Alex",
        email: "visitor@example.com",
        phone: null,
      },
      card: {
        slug: "demo",
        displayName: "Demo",
        email: "owner@example.com",
        photoKey: null,
        contact: {
          name: { full: "Demo", family: "Demo", given: "D", nickname: "D" },
          org: "",
          title: "",
          phone: "",
          vcardNote: "",
          urls: [],
        },
        pageCopy: { emailFromName: "Demo" },
      },
    });

    await processFollowupQueueBatch(
      { messages: [message] },
      {
        ...leadEmailConsumerEnabled,
        isLeadEmailEnabled: async () => false,
        weMetEnv: "preview",
        baseUrl: "https://we-met.link",
        testMailTo: "inbox@example.com",
        emailSender: { send },
        assets: { get: vi.fn() },
        ledger: new MemoryConsumerLeadDeliveryLedger(),
        sinkHandlers: new Map(),
        logVisitorFollowupAttemptFailure: vi.fn(),
        logVisitorFollowupPermanentFailure: vi.fn(),
        logMalformedVisitorFollowup: vi.fn(),
        logUnsupportedType: vi.fn(),
        logMissingPhoto: vi.fn(),
        logNonJpegPhoto: vi.fn(),
        logLeadSinkAttemptFailure: vi.fn(),
        logLeadSinkPermanentFailure: vi.fn(),
        logMalformedLeadSink: vi.fn(),
        logLedgerRowMissing: vi.fn(),
        logLedgerUpdateFailed: vi.fn(),
        logLeadSinkLedgerRecordFailed: vi.fn(),
        logLeadSinkLedgerMarkFailed: vi.fn(),
        logLeadSinkAppendDeferred: vi.fn(),
        now: () => new Date("2026-10-12T12:00:00.000Z"),
      },
    );

    expect(send).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("marks lead sink ledger failed with lead_email_paused when paused", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const send = vi.fn();
    const message = createMessage({
      type: "lead_sink_record",
      sinkId: "sink-1",
      sinkKind: "email",
      sinkConfig: { to: "owner@example.com" },
      lead: {
        leadId: "lead-1",
        submittedAt: "2026-10-12T00:00:00.000Z",
        environment: "preview",
        isTestLead: true,
        name: "Alex",
        email: "visitor@example.com",
        phone: null,
      },
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: "https://we-met.link/hi/demo",
    });

    await processLeadSinkQueueMessage(message, {
      ...leadEmailConsumerEnabled,
      isLeadEmailEnabled: async () => false,
      sinkHandlers: createLeadSinkHandlerRegistry({
        email: createEmailLeadSinkHandler({
          weMetEnv: "preview",
          testMailTo: "inbox@example.com",
          ownerFromEmail: "hello@we-met.link",
          fromDisplayName: "We Met",
          emailSender: { send },
          logMalformedLeadSink: vi.fn(),
        }),
      }),
      ledger,
      logUnsupportedType: vi.fn(),
      logMalformedLeadSink: vi.fn(),
      logLeadSinkAttemptFailure: vi.fn(),
      logLeadSinkPermanentFailure: vi.fn(),
      logLeadSinkLedgerRecordFailed: vi.fn(),
      logLeadSinkLedgerMarkFailed: vi.fn(),
      logLedgerRowMissing: vi.fn(),
      logLedgerUpdateFailed: vi.fn(),
      logLeadSinkAppendDeferred: vi.fn(),
      now: () => new Date("2026-10-12T12:00:00.000Z"),
    });

    expect(send).not.toHaveBeenCalled();
    const row = ledger.getRowState("lead-1", "sink-1", "record");
    expect(row?.status).toBe("failed");
    expect(row?.errorCode).toBe("lead_email_paused");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });
});
