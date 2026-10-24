import { describe, expect, it, vi } from "vitest";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { OWNER_EMAIL_FALLBACK_DELAY_SECONDS } from "@/exchange/owner-email-timing";
import {
  dispatchLeadOnExchange,
  dispatchOwnerEmailImmediate,
  type LeadSinkDispatchDeps,
} from "@/exchange/lead-sink/dispatcher";
import type { LeadSinkRecord } from "@/card-data/types";
import type { VisitorLead } from "@/exchange/types";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { processOwnerEmailFinalize } from "@/exchange/process-owner-email-finalize";
import { exampleCardInput } from "../helpers/example-card";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import { createFakeLeadSinkHandler } from "../followup-email-consumer/fake-lead-sink-handler";
import { MemoryConsumerLeadDeliveryLedger } from "../followup-email-consumer/memory-consumer-ledger";
import { leadEmailControlsFixture } from "../helpers/lead-email-deps";

const NOW = new Date("2026-10-12T12:00:00.000Z");
const SOURCE_URL = "https://we-met.link/hi/demo";

const lead: VisitorLead = {
  leadId: "lead-1",
  submittedAt: NOW.toISOString(),
  environment: "local",
  isTestLead: true,
  name: "Sam Rivera",
  email: "visitor@example.com",
  phone: null,
};

function sink(id: string): LeadSinkRecord {
  return {
    id,
    cardId: "card-1",
    kind: "email",
    config: { to: "owner@example.com" },
    enabled: true,
    createdAt: "",
    updatedAt: "",
  };
}

function createDispatchDeps(
  sinkMessages: Array<{ message: unknown; options?: unknown }>,
) {
  const ledger = new MemoryLeadDeliveryLedger();
  const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
  const deliveryLogger = {
    logLedgerWriteFailed: vi.fn(),
    logLedgerEnqueueFailed: vi.fn(),
  };
  let ledgerSeq = 0;
  const deps: LeadSinkDispatchDeps = {
    producer: {
      enqueueLeadSink: async (message, options) => {
        sinkMessages.push({ message, options });
      },
    },
    sinkLogger: { logSinkEnqueueFailure: vi.fn() },
    ledger,
    exchangeOwnerEmail,
    deliveryLogger,
    now: () => NOW,
    createLedgerId: () => `ledger-${++ledgerSeq}`,
  };
  return { deps, ledger, exchangeOwnerEmail, deliveryLogger };
}

describe("owner email timing (integration)", () => {
  it("enqueues a delayed fallback on exchange and immediate send on finalize", async () => {
    const sinkMessages: Array<{
      message: unknown;
      options?: { delaySeconds?: number };
    }> = [];
    const { deps, exchangeOwnerEmail } = createDispatchDeps(sinkMessages);
    await dispatchLeadOnExchange(
      [sink("sink-a")],
      lead,
      "card-1",
      "demo",
      SOURCE_URL,
      "Didi",
      deps,
    );
    expect(sinkMessages).toHaveLength(1);
    expect((sinkMessages[0].message as { type: string }).type).toBe("owner_email_due");
    expect(sinkMessages[0].options?.delaySeconds).toBe(
      OWNER_EMAIL_FALLBACK_DELAY_SECONDS,
    );

    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const finalize = await processOwnerEmailFinalize(
      lead,
      { phone: null, jobTitle: "CTO", company: null, note: null },
      card,
      [sink("sink-a")],
      {
        leadSinkQueue: deps.producer,
        deliveryLedger: deps.ledger,
        deliveryLogger: deps.deliveryLogger,
        leadSinkLogger: deps.sinkLogger,
        exchangeOwnerEmail,
        createLedgerId: deps.createLedgerId,
        now: deps.now,
        baseUrl: "https://we-met.link",
      },
    );
    expect(finalize.status).toBe("success");
    expect(sinkMessages).toHaveLength(2);
    expect((sinkMessages[1].message as { type: string }).type).toBe(
      "lead_sink_owner_email",
    );
  });

  it("consumer acks duplicate owner email deliveries without sending twice", async () => {
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    consumerLedger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    const handler = createFakeLeadSinkHandler({
      deliverOwnerEmail: async () => {
        sendCount.value += 1;
        return {
          externalRef: JSON.stringify({ provider: "cloudflare", messageId: "m1" }),
        };
      },
    });
    const deps = {
      readLeadEmailControls: async () => leadEmailControlsFixture,
      sinkHandlers: new Map([["email", handler]]),
      ledger: consumerLedger,
      logUnsupportedType: vi.fn(),
      logMalformedLeadSink: vi.fn(),
      logLeadSinkAttemptFailure: vi.fn(),
      logLeadSinkPermanentFailure: vi.fn(),
      logLeadSinkLedgerRecordFailed: vi.fn(),
      logLeadSinkLedgerMarkFailed: vi.fn(),
      logLedgerRowMissing: vi.fn(),
      logLedgerUpdateFailed: vi.fn(),
      logLeadSinkAppendDeferred: vi.fn(),
      now: () => NOW,
    };
    const body = {
      type: "lead_sink_owner_email",
      sinkId: "sink-a",
      sinkKind: "email",
      sinkConfig: { to: "owner@example.com" },
      lead,
      details: { phone: null, jobTitle: null, company: null, note: null },
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: SOURCE_URL,
    };
    const message = {
      id: "1",
      attempts: 1,
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(message, deps);
    await processLeadSinkQueueMessage({ ...message, id: "2" }, deps);
    expect(sendCount.value).toBe(1);
    expect(message.ack).toHaveBeenCalled();
  });

  it("immediate dispatch after dismiss uses empty details", async () => {
    const sinkMessages: Array<{ message: unknown }> = [];
    const { deps } = createDispatchDeps(sinkMessages);
    const outcome = await dispatchOwnerEmailImmediate(
      [sink("sink-a")],
      lead,
      { phone: null, jobTitle: null, company: null, note: null },
      "card-1",
      "demo",
      SOURCE_URL,
      "Didi",
      deps,
    );
    expect(outcome).toBe("enqueued");
    const details = (
      sinkMessages[0]?.message as { details: { jobTitle: string | null } }
    ).details;
    expect(details.jobTitle).toBeNull();
  });
});
