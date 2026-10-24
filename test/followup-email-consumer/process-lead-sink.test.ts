import { describe, expect, it, vi } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import type { FollowupQueueMessage } from "@/followup-email-consumer/process-batch";
import type { LeadSinkConsumerDeps } from "@/followup-email-consumer/process-lead-sink";
import { createFakeLeadSinkHandler } from "./fake-lead-sink-handler";
import { MemoryConsumerLeadDeliveryLedger } from "./memory-consumer-ledger";
import { leadEmailConsumerEnabled } from "../helpers/lead-email-deps";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { seedOwnerEmailExchangeRow } from "../helpers/owner-email-consumer";

function sinkOwnerEmailBody() {
  return {
    type: "lead_sink_owner_email",
    sinkId: "sink-1",
    sinkKind: "fake",
    sinkConfig: {},
    lead: {
      leadId: "lead-1",
      submittedAt: "2026-10-12T00:00:00.000Z",
      environment: "preview",
      isTestLead: true,
      name: "Alex",
      email: "a@example.com",
      phone: null,
    },
    details: { phone: null, jobTitle: null, company: null, note: null },
    cardId: "card-1",
    cardSlug: "demo",
    sourceUrl: "https://we-met.link/hi/demo",
  };
}

function sinkAppendBody() {
  return {
    type: "lead_sink_append_details",
    sinkId: "sink-1",
    sinkKind: "fake",
    sinkConfig: {},
    lead: { leadId: "lead-1", name: "Alex", email: "a@example.com" },
    details: { phone: null, jobTitle: null, company: null, note: null },
    detailsSubmittedAt: "2026-10-12T01:00:00.000Z",
    cardId: "card-1",
    cardSlug: "demo",
    sourceUrl: "https://we-met.link/hi/demo",
  };
}

function createMessage(
  body: unknown,
  overrides: Partial<FollowupQueueMessage> = {},
): FollowupQueueMessage {
  return {
    id: "msg-1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

function createDeps(
  ledger: MemoryConsumerLeadDeliveryLedger,
  handler = createFakeLeadSinkHandler(),
  overrides: Partial<LeadSinkConsumerDeps> = {},
): LeadSinkConsumerDeps {
  const resolvedLedger = overrides.ledger ?? ledger;
  const exchangeOwnerEmail =
    overrides.exchangeOwnerEmail ?? new MemoryExchangeOwnerEmailStore();
  return {
    ...leadEmailConsumerEnabled,
    exchangeOwnerEmail,
    sinkHandlers: new Map([["fake", handler]]),
    ledger: resolvedLedger,
    logUnsupportedType: vi.fn(),
    logMalformedLeadSink: vi.fn(),
    logLeadSinkAttemptFailure: vi.fn(),
    logLeadSinkPermanentFailure: vi.fn(),
    logLeadSinkLedgerRecordFailed: vi.fn(),
    logLeadSinkLedgerMarkFailed: vi.fn(),
    logLedgerRowMissing: vi.fn(),
    logLedgerUpdateFailed: vi.fn(),
    logLeadSinkAppendDeferred: vi.fn(),
    logExchangeOwnerEmailRowMissing: vi.fn(),
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    ...overrides,
  };
}

describe("processLeadSinkQueueMessage with fake sink (unit)", () => {
  it("delivers owner email messages through deliverOwnerEmail", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      "lead-1",
      "card-1",
      "2026-10-12T12:00:00.000Z",
    );
    let ownerDelivered = false;
    const handler = createFakeLeadSinkHandler({
      onOwnerEmail: () => {
        ownerDelivered = true;
      },
    });
    const deps = createDeps(ledger, handler, { exchangeOwnerEmail });
    const message = createMessage(sinkOwnerEmailBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(ownerDelivered).toBe(true);
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("runs legacy append with null recordRef", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "append");
    let recordRef: unknown = "unset";
    const handler = createFakeLeadSinkHandler({
      onAppend: (_m, ctx) => {
        recordRef = ctx.recordRef;
      },
    });
    const deps = createDeps(ledger, handler);
    const message = createMessage(sinkAppendBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(recordRef).toBeNull();
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acks without send when ledger row already sent", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedSent("lead-1", "sink-1", "record");
    const handler = createFakeLeadSinkHandler({
      onOwnerEmail: () => {
        throw new Error("should not deliver");
      },
    });
    const deps = createDeps(ledger, handler);
    const message = createMessage(sinkOwnerEmailBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("retries retryable handler failures", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      "lead-1",
      "card-1",
      "2026-10-12T12:00:00.000Z",
    );
    const handler = createFakeLeadSinkHandler({
      deliverOwnerEmail: async () => {
        throw new FollowupEmailError("cloudflare_send_failed");
      },
    });
    const deps = createDeps(ledger, handler, { exchangeOwnerEmail });
    const message = createMessage(sinkOwnerEmailBody(), { attempts: 2 });

    await processLeadSinkQueueMessage(message, deps);

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });
});
