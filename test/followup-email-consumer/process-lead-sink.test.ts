import { describe, expect, it, vi } from "vitest";
import { FollowupEmailError } from "@/email/followup-email-error";
import {
  followupEmailRetryDelaySeconds,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "@/followup-email-consumer/retry";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import type { FollowupQueueMessage } from "@/followup-email-consumer/process-batch";
import type { LeadSinkConsumerDeps } from "@/followup-email-consumer/process-lead-sink";
import { createFakeLeadSinkHandler } from "./fake-lead-sink-handler";
import { MemoryConsumerLeadDeliveryLedger } from "./memory-consumer-ledger";
import { leadEmailConsumerEnabled } from "../helpers/lead-email-deps";

function sinkRecordBody() {
  return {
    type: "lead_sink_record",
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
    details: { jobTitle: null, company: null, note: null },
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
  return {
    ...leadEmailConsumerEnabled,
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
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    ...overrides,
  };
}

describe("processLeadSinkQueueMessage with fake sink (unit)", () => {
  it("stores record externalRef and passes it to append", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const recordRef = JSON.stringify({ fakeId: "object-42" });
    const handler = createFakeLeadSinkHandler({ recordRef });
    const deps = createDeps(ledger, handler);

    await processLeadSinkQueueMessage(createMessage(sinkRecordBody()), deps);
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.externalRef).toBe(
      recordRef,
    );

    ledger.seedQueued("lead-1", "sink-1", "append");
    let appendCtx: unknown;
    const appendHandler = createFakeLeadSinkHandler({
      onAppend: (_msg, ctx) => {
        appendCtx = ctx.recordRef;
      },
    });
    const appendDeps = createDeps(ledger, appendHandler);
    const appendMsg = createMessage(sinkAppendBody());
    await processLeadSinkQueueMessage(appendMsg, appendDeps);

    expect(appendCtx).toEqual({ fakeId: "object-42" });
    expect(appendMsg.ack).toHaveBeenCalledOnce();
  });

  it("defers append while record is queued", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    ledger.seedQueued("lead-1", "sink-1", "append");
    const deps = createDeps(ledger);
    const message = createMessage(sinkAppendBody(), { attempts: 2 });

    await processLeadSinkQueueMessage(message, deps);

    expect(deps.logLeadSinkAppendDeferred).toHaveBeenCalledWith("lead-1", "sink-1", 2);
    expect(message.retry).toHaveBeenCalledWith({
      delaySeconds: followupEmailRetryDelaySeconds(2),
    });
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("fails append with record_unavailable when record failed and appendRequiresRecord", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "append");
    ledger.seedQueued("lead-1", "sink-1", "record");
    await ledger.markFailed({
      leadId: "lead-1",
      sinkId: "sink-1",
      phase: "record",
      errorCode: "upstream",
      updatedAt: "2026-10-12T12:00:00.000Z",
    });
    const handler = createFakeLeadSinkHandler({ appendRequiresRecord: true });
    const deps = createDeps(ledger, handler);
    const message = createMessage(sinkAppendBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(ledger.getRowState("lead-1", "sink-1", "append")?.errorCode).toBe(
      "record_unavailable",
    );
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("runs append with null recordRef when appendRequiresRecord is false", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "append");
    let recordRef: unknown = "unset";
    const handler = createFakeLeadSinkHandler({
      appendRequiresRecord: false,
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

  it("treats queued record as unavailable on final append attempt", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    ledger.seedQueued("lead-1", "sink-1", "append");
    const handler = createFakeLeadSinkHandler({ appendRequiresRecord: true });
    const deps = createDeps(ledger, handler);
    const message = createMessage(sinkAppendBody(), {
      attempts: MAX_VISITOR_FOLLOWUP_ATTEMPTS,
    });

    await processLeadSinkQueueMessage(message, deps);

    expect(ledger.getRowState("lead-1", "sink-1", "append")?.errorCode).toBe(
      "record_unavailable",
    );
    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acks without send when ledger row already sent", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedSent("lead-1", "sink-1", "record");
    const handler = createFakeLeadSinkHandler({
      onRecord: () => {
        throw new Error("should not deliver");
      },
    });
    const deps = createDeps(ledger, handler);
    const message = createMessage(sinkRecordBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(message.ack).toHaveBeenCalledOnce();
  });

  it("acks after send when markSent throws", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const markSent = vi.fn(async () => {
      throw new Error("db down");
    });
    const brokenLedger = {
      ...ledger,
      markSent,
      findRow: ledger.findRow.bind(ledger),
      recordFailedAttempt: ledger.recordFailedAttempt.bind(ledger),
      markFailed: ledger.markFailed.bind(ledger),
    };
    const deps = createDeps(ledger, undefined, { ledger: brokenLedger });
    const message = createMessage(sinkRecordBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(deps.logLedgerUpdateFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-1",
      "ledger_update_failed",
    );
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("still retries when recordFailedAttempt throws", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const handler = createFakeLeadSinkHandler({
      deliverRecord: async () => {
        throw new FollowupEmailError("gmail_network_error");
      },
    });
    const recordFailedAttempt = vi.fn(async () => {
      throw new Error("db down");
    });
    const brokenLedger = {
      ...ledger,
      recordFailedAttempt,
      findRow: ledger.findRow.bind(ledger),
      markSent: ledger.markSent.bind(ledger),
      markFailed: ledger.markFailed.bind(ledger),
    };
    const deps = createDeps(ledger, handler, { ledger: brokenLedger });
    const message = createMessage(sinkRecordBody(), { attempts: 2 });

    await processLeadSinkQueueMessage(message, deps);

    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(deps.logLeadSinkLedgerRecordFailed).toHaveBeenCalled();
  });

  it("rejects invalid externalRef without retry after successful send", async () => {
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued("lead-1", "sink-1", "record");
    const handler = createFakeLeadSinkHandler({
      recordRef: JSON.stringify({ nested: { bad: true } }),
    });
    const deps = createDeps(ledger, handler);
    const message = createMessage(sinkRecordBody());

    await processLeadSinkQueueMessage(message, deps);

    expect(deps.logLedgerUpdateFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-1",
      "external_ref_invalid",
    );
    expect(ledger.getRowState("lead-1", "sink-1", "record")?.externalRef).toBeNull();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });
});
