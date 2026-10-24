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
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";

const pausedConsumerExtras = {
  exchangeOwnerEmail: new MemoryExchangeOwnerEmailStore(),
  logExchangeOwnerEmailRowMissing: vi.fn(),
  logExchangeOwnerEmailConfirmFailed: vi.fn(),
  logExchangeOwnerEmailContentionExhausted: vi.fn(),
  logExchangeVisitorLetterRowMissing: vi.fn(),
  logExchangeVisitorLetterConfirmFailed: vi.fn(),
  logExchangeVisitorLetterContentionExhausted: vi.fn(),
  logExchangeVisitorLetterSkippedPriorSend: vi.fn(),
};

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

    const logVisitorFollowupDroppedPaused = vi.fn();
    await processFollowupQueueBatch(
      { messages: [message] },
      {
        ...leadEmailConsumerEnabled,
        readLeadEmailControls: async () => ({
          leadEmailEnabled: false,
          visitorEmailMode: "direct",
          dailyCapGlobal: 150,
          dailyCapPerCard: 50,
        }),
        weMetEnv: "preview",
        baseUrl: "https://we-met.link",
        testMailTo: "inbox@example.com",
        sendEmail: send,
        outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
        assets: { get: vi.fn() },
        ledger: new MemoryConsumerLeadDeliveryLedger(),
        sinkHandlers: new Map(),
        logVisitorFollowupAttemptFailure: vi.fn(),
        logVisitorFollowupPermanentFailure: vi.fn(),
        logMalformedVisitorFollowup: vi.fn(),
        logVisitorFollowupDroppedPaused,
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
        ...pausedConsumerExtras,
        now: () => new Date("2026-10-12T12:00:00.000Z"),
      },
    );

    expect(logVisitorFollowupDroppedPaused).toHaveBeenCalledWith("lead-1");
    expect(send).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("sends visitor letter to the owner when visitor_email_mode is owner_relay", async () => {
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
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    exchangeOwnerEmail.rows.set("lead-1", {
      leadId: "lead-1",
      cardId: "card-1",
      triggeredAt: null,
      ownerEmailClaimedAt: null,
      ownerEmailSentAt: null,
      visitorLetterClaimedAt: null,
      visitorLetterSentAt: null,
      createdAt: "2026-10-12T12:00:00.000Z",
      updatedAt: "2026-10-12T12:00:00.000Z",
    });

    await processFollowupQueueBatch(
      { messages: [message] },
      {
        ...leadEmailConsumerEnabled,
        readLeadEmailControls: async () => ({
          leadEmailEnabled: true,
          visitorEmailMode: "owner_relay",
          dailyCapGlobal: 150,
          dailyCapPerCard: 50,
        }),
        weMetEnv: "preview",
        baseUrl: "https://we-met.link",
        testMailTo: "inbox@example.com",
        sendEmail: send,
        outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
        fromDisplayName: "We Met",
        assets: {
          get: vi.fn(async () => ({
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array([0xff, 0xd8, 0xff]));
                controller.close();
              },
            }),
            contentType: "image/jpeg",
          })),
        },
        ledger: new MemoryConsumerLeadDeliveryLedger(),
        sinkHandlers: new Map(),
        logVisitorFollowupAttemptFailure: vi.fn(),
        logVisitorFollowupPermanentFailure: vi.fn(),
        logMalformedVisitorFollowup: vi.fn(),
        logVisitorFollowupDroppedPaused: vi.fn(),
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
        ...pausedConsumerExtras,
        exchangeOwnerEmail,
        now: () => new Date("2026-10-12T12:00:00.000Z"),
      },
    );

    expect(send).toHaveBeenCalledOnce();
    const outbound = send.mock.calls[0]![0]!;
    expect(outbound.to).toBe("inbox@example.com");
    expect(outbound.replyTo).toBe("inbox@example.com");
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
      ...pausedConsumerExtras,
      readLeadEmailControls: async () => ({
        leadEmailEnabled: false,
        visitorEmailMode: "direct",
        dailyCapGlobal: 150,
        dailyCapPerCard: 50,
      }),
      sinkHandlers: createLeadSinkHandlerRegistry({
        email: createEmailLeadSinkHandler({
          weMetEnv: "preview",
          testMailTo: "inbox@example.com",
          outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
          fromDisplayName: "We Met",
          sendEmail: send,
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
      ...pausedConsumerExtras,
    });

    expect(send).not.toHaveBeenCalled();
    const row = ledger.getRowState("lead-1", "sink-1", "record");
    expect(row?.status).toBe("failed");
    expect(row?.errorCode).toBe("lead_email_paused");
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("does not ack or retry when lead email settings cannot be read", async () => {
    const message = createMessage({
      type: "visitor_followup",
      lead: {
        leadId: "lead-2",
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
    const send = vi.fn();

    await expect(
      processFollowupQueueBatch(
        { messages: [message] },
        {
          ...leadEmailConsumerEnabled,
          readLeadEmailControls: async () => {
            throw new Error("d1 unavailable");
          },
          weMetEnv: "preview",
          baseUrl: "https://we-met.link",
          testMailTo: "inbox@example.com",
          sendEmail: send,
          outboundFrom: { cloudflareFromEmail: "hello@mail.we-met.link" },
          assets: { get: vi.fn() },
          ledger: new MemoryConsumerLeadDeliveryLedger(),
          sinkHandlers: new Map(),
          logVisitorFollowupAttemptFailure: vi.fn(),
          logVisitorFollowupPermanentFailure: vi.fn(),
          logMalformedVisitorFollowup: vi.fn(),
          logVisitorFollowupDroppedPaused: vi.fn(),
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
          ...pausedConsumerExtras,
          now: () => new Date("2026-10-12T12:00:00.000Z"),
        },
      ),
    ).rejects.toThrow("d1 unavailable");
    expect(send).not.toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(message.retry).not.toHaveBeenCalled();
  });
});
