import { describe, expect, it, vi } from "vitest";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { OWNER_EMAIL_SEND_CLAIM_STALE_MS } from "@/exchange-owner-email/types";
import {
  EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS,
  OWNER_EMAIL_FALLBACK_DELAY_SECONDS,
} from "@/exchange/owner-email-timing";
import {
  dispatchLeadOnExchange,
  type LeadDeliveryDispatchLogger,
  type LeadSinkDispatchDeps,
} from "@/exchange/lead-sink/dispatcher";
import type { LeadSinkRecord } from "@/card-data/types";
import type { VisitorLead } from "@/exchange/types";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { processOwnerEmailFinalize } from "@/exchange/process-owner-email-finalize";
import { processDetailsDismiss } from "@/exchange/process-details-dismiss";
import { createDetailsToken } from "@/exchange/token";
import { exampleCardInput } from "../helpers/example-card";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import {
  processLeadSinkQueueMessage,
  type LeadSinkConsumerDeps,
} from "@/followup-email-consumer/process-lead-sink";
import { MemoryConsumerLeadDeliveryLedger } from "../followup-email-consumer/memory-consumer-ledger";
import { FollowupEmailError } from "@/email/followup-email-error";
import { createFakeLeadSinkHandler } from "../followup-email-consumer/fake-lead-sink-handler";
import { leadEmailControlsFixture } from "../helpers/lead-email-deps";
import {
  createOwnerEmailConsumerDeps,
  seedOwnerEmailExchangeRow,
} from "../helpers/owner-email-consumer";

const NOW = new Date("2026-10-12T12:00:00.000Z");

function rowClaimStillHeld(
  store: MemoryExchangeOwnerEmailStore,
  leadId: string,
): boolean {
  const row = store.rows.get(leadId);
  return Boolean(row?.ownerEmailClaimedAt && !row.ownerEmailSentAt);
}
const SOURCE_URL = "https://we-met.link/hi/demo";

const noopFollowupQueue = {
  enqueueVisitorLetter: async () => undefined,
};

function ownerEmailFinalizeDeps(
  deps: LeadSinkDispatchDeps,
  exchangeOwnerEmail: MemoryExchangeOwnerEmailStore,
  deliveryLogger: LeadDeliveryDispatchLogger,
) {
  return {
    tokenSecret: "test-secret",
    resolveVisitorEmailMode: async (): Promise<VisitorEmailMode> => "owner_relay",
    followupQueue: noopFollowupQueue,
    leadSinkQueue: deps.producer,
    deliveryLedger: deps.ledger,
    deliveryLogger,
    leadSinkLogger: deps.sinkLogger,
    exchangeOwnerEmail,
    createLedgerId: deps.createLedgerId,
    now: deps.now,
    baseUrl: "https://we-met.link",
    logExchangeVisitorLetterEnqueueFailed: vi.fn(),
  };
}

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

type QueuedSinkMessage = { message: unknown; options?: { delaySeconds?: number } };

function createDispatchDeps(
  sinkMessages: QueuedSinkMessage[],
  failImmediateEnqueue = false,
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
        if (
          failImmediateEnqueue &&
          typeof message === "object" &&
          message &&
          (message as { type?: string }).type === "lead_sink_owner_email"
        ) {
          throw new Error("enqueue_failed");
        }
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
  return { deps, ledger, exchangeOwnerEmail, deliveryLogger, sinkMessages };
}

function queueBodyFromSinkMessage(message: unknown) {
  return message as Record<string, unknown>;
}

async function deliverQueuedOwnerEmail(
  body: Record<string, unknown>,
  exchangeOwnerEmail: MemoryExchangeOwnerEmailStore,
  ledger: MemoryConsumerLeadDeliveryLedger,
  sendCount: { value: number },
  deliverOverrides?: Partial<Parameters<typeof createFakeLeadSinkHandler>[0]>,
  consumerOverrides?: Partial<LeadSinkConsumerDeps>,
) {
  await seedOwnerEmailExchangeRow(
    exchangeOwnerEmail,
    lead.leadId,
    "card-1",
    NOW.toISOString(),
  );
  ledger.seedQueued(lead.leadId, "sink-a", "record");
  const handler = createFakeLeadSinkHandler({
    deliverOwnerEmail: async () => {
      sendCount.value += 1;
      return {
        externalRef: JSON.stringify({ provider: "cloudflare", messageId: "m1" }),
      };
    },
    ...deliverOverrides,
  });
  const consumerDeps = {
    readLeadEmailControls: async () => leadEmailControlsFixture,
    exchangeOwnerEmail,
    sinkHandlers: new Map([["email", handler]]),
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
    logExchangeOwnerEmailRowMissing: vi.fn(),
    logExchangeOwnerEmailConfirmFailed: vi.fn(),
    logExchangeOwnerEmailContentionExhausted: vi.fn(),
    now: () => NOW,
    ...consumerOverrides,
  };
  const message = {
    id: "q-1",
    attempts: 1,
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
  await processLeadSinkQueueMessage(message, consumerDeps);
  return message;
}

describe("owner email timing (integration)", () => {
  it("enqueues a delayed fallback on exchange", async () => {
    const sinkMessages: QueuedSinkMessage[] = [];
    const { deps } = createDispatchDeps(sinkMessages);
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
  });

  it("(a) immediate then fallback delivers exactly one owner email", async () => {
    const sinkMessages: QueuedSinkMessage[] = [];
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
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    await processOwnerEmailFinalize(
      lead,
      { phone: null, jobTitle: "CTO", company: null, note: null },
      card,
      [sink("sink-a")],
      ownerEmailFinalizeDeps(deps, exchangeOwnerEmail, deps.deliveryLogger),
    );
    expect(sinkMessages).toHaveLength(2);

    const sendCount = { value: 0 };
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    const immediateBody = queueBodyFromSinkMessage(sinkMessages[1].message);
    await deliverQueuedOwnerEmail(
      immediateBody,
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
    const fallbackBody = queueBodyFromSinkMessage(sinkMessages[0].message);
    await deliverQueuedOwnerEmail(
      fallbackBody,
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
    expect(sendCount.value).toBe(1);
  });

  it("(b) fallback only sends once when details are never submitted", async () => {
    const sinkMessages: QueuedSinkMessage[] = [];
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
    const sendCount = { value: 0 };
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    await deliverQueuedOwnerEmail(
      queueBodyFromSinkMessage(sinkMessages[0].message),
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
    expect(sendCount.value).toBe(1);
  });

  it("(c) fallback first then late finalize does not send twice", async () => {
    const sinkMessages: QueuedSinkMessage[] = [];
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
    const sendCount = { value: 0 };
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    await deliverQueuedOwnerEmail(
      queueBodyFromSinkMessage(sinkMessages[0].message),
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const finalize = await processOwnerEmailFinalize(
      lead,
      { phone: null, jobTitle: "CTO", company: null, note: null },
      card,
      [sink("sink-a")],
      ownerEmailFinalizeDeps(deps, exchangeOwnerEmail, deps.deliveryLogger),
    );
    expect(finalize.status).toBe("success");
    await deliverQueuedOwnerEmail(
      queueBodyFromSinkMessage(sinkMessages[1].message),
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
    expect(sendCount.value).toBe(1);
  });

  it("(d) failed immediate enqueue still allows fallback to send once", async () => {
    const sinkMessages: QueuedSinkMessage[] = [];
    const { deps, exchangeOwnerEmail } = createDispatchDeps(sinkMessages, true);
    await dispatchLeadOnExchange(
      [sink("sink-a")],
      lead,
      "card-1",
      "demo",
      SOURCE_URL,
      "Didi",
      deps,
    );
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const finalize = await processOwnerEmailFinalize(
      lead,
      { phone: null, jobTitle: "CTO", company: null, note: null },
      card,
      [sink("sink-a")],
      ownerEmailFinalizeDeps(deps, exchangeOwnerEmail, deps.deliveryLogger),
    );
    expect(finalize.status).toBe("success");
    expect(sinkMessages).toHaveLength(1);

    const sendCount = { value: 0 };
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    const afterDeferWindow = new Date(
      NOW.getTime() + EXCHANGE_EMAIL_TRIGGER_DEFER_MAX_MS + 60_000,
    );
    await deliverQueuedOwnerEmail(
      queueBodyFromSinkMessage(sinkMessages[0].message),
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
      undefined,
      { now: () => afterDeferWindow },
    );
    expect(sendCount.value).toBe(1);
  });

  it("(e) dismiss and submit race still yields one send", async () => {
    const sinkMessages: QueuedSinkMessage[] = [];
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
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const tokenDeps = {
      environment: "local",
      ...ownerEmailFinalizeDeps(deps, exchangeOwnerEmail, deps.deliveryLogger),
    };
    const token = createDetailsToken(
      "secret",
      {
        leadId: lead.leadId,
        cardId: card.id,
        cardSlug: card.slug,
        visitorEmail: lead.email,
        visitorName: lead.name,
      },
      Math.floor(NOW.getTime() / 1000),
    );
    await Promise.all([
      processOwnerEmailFinalize(
        lead,
        { phone: null, jobTitle: "CTO", company: null, note: null },
        card,
        [sink("sink-a")],
        tokenDeps,
      ),
      processDetailsDismiss({ token }, card, [sink("sink-a")], tokenDeps),
    ]);

    const sendCount = { value: 0 };
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    for (const queued of sinkMessages.slice(1)) {
      await deliverQueuedOwnerEmail(
        queueBodyFromSinkMessage(queued.message),
        exchangeOwnerEmail,
        consumerLedger,
        sendCount,
      );
    }
    await deliverQueuedOwnerEmail(
      queueBodyFromSinkMessage(sinkMessages[0].message),
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
    expect(sendCount.value).toBe(1);
  });

  it("retries on claim contention and does not ack", async () => {
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      lead.leadId,
      "card-1",
      NOW.toISOString(),
    );
    const row = exchangeOwnerEmail.rows.get(lead.leadId);
    expect(row).toBeDefined();
    row!.ownerEmailClaimedAt = NOW.toISOString();

    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    const logConfirmFailed = vi.fn();
    const deps = createOwnerEmailConsumerDeps(exchangeOwnerEmail, ledger, sendCount, {
      logExchangeOwnerEmailConfirmFailed: logConfirmFailed,
    });
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
      id: "contention-1",
      attempts: 1,
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(message, deps);
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
    expect(sendCount.value).toBe(0);
  });

  it("redelivers after a crashed stale claim and sends exactly once", async () => {
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      lead.leadId,
      "card-1",
      NOW.toISOString(),
    );
    const row = exchangeOwnerEmail.rows.get(lead.leadId);
    expect(row).toBeDefined();
    const crashedClaimAt = new Date(
      NOW.getTime() - OWNER_EMAIL_SEND_CLAIM_STALE_MS - 60_000,
    ).toISOString();
    row!.ownerEmailClaimedAt = crashedClaimAt;

    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    const afterStale = new Date(
      NOW.getTime() + OWNER_EMAIL_SEND_CLAIM_STALE_MS + 60_000,
    );
    const deps = createOwnerEmailConsumerDeps(exchangeOwnerEmail, ledger, sendCount, {
      now: () => afterStale,
    });
    const body = {
      type: "owner_email_due",
      sinkId: "sink-a",
      sinkKind: "email",
      sinkConfig: { to: "owner@example.com" },
      lead,
      details: { phone: null, jobTitle: null, company: null, note: null },
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: SOURCE_URL,
    };
    const first = {
      id: "stale-1",
      attempts: 1,
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(first, deps);
    expect(sendCount.value).toBe(1);
    expect(first.ack).toHaveBeenCalledOnce();

    const second = {
      ...first,
      id: "stale-2",
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(second, deps);
    expect(sendCount.value).toBe(1);
    expect(second.ack).toHaveBeenCalledOnce();
  });

  it("acks without resend when confirmOwnerEmailSent fails after a successful send", async () => {
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      lead.leadId,
      "card-1",
      NOW.toISOString(),
    );
    const confirmSpy = vi
      .spyOn(exchangeOwnerEmail, "confirmOwnerEmailSent")
      .mockRejectedValue(new Error("d1 write failed"));

    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    const logConfirmFailed = vi.fn();
    const deps = createOwnerEmailConsumerDeps(exchangeOwnerEmail, ledger, sendCount, {
      logExchangeOwnerEmailConfirmFailed: logConfirmFailed,
    });
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
      id: "confirm-fail-1",
      attempts: 1,
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(message, deps);
    expect(sendCount.value).toBe(1);
    expect(logConfirmFailed).toHaveBeenCalledWith(lead.leadId);
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(rowClaimStillHeld(exchangeOwnerEmail, lead.leadId)).toBe(true);
    confirmSpy.mockRestore();
  });

  it("releases the send claim after a retryable failure so a retry can send", async () => {
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      lead.leadId,
      "card-1",
      NOW.toISOString(),
    );
    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    let attempts = 0;
    const handler = createFakeLeadSinkHandler({
      deliverOwnerEmail: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new FollowupEmailError("cloudflare_temporary_failure");
        }
        sendCount.value += 1;
        return {
          externalRef: JSON.stringify({ provider: "cloudflare", messageId: "m1" }),
        };
      },
    });
    const deps = createOwnerEmailConsumerDeps(exchangeOwnerEmail, ledger, sendCount, {
      sinkHandlers: new Map([["email", handler]]),
    });
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
    const first = {
      id: "1",
      attempts: 1,
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(first, deps);
    expect(first.retry).toHaveBeenCalled();
    expect(sendCount.value).toBe(0);

    const second = { ...first, id: "2", attempts: 2 };
    await processLeadSinkQueueMessage(second, deps);
    expect(sendCount.value).toBe(1);
    expect(second.ack).toHaveBeenCalled();
  });

  it("defers owner_email_due while triggered_at is set and details send is pending", async () => {
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      lead.leadId,
      "card-1",
      NOW.toISOString(),
    );
    const row = exchangeOwnerEmail.rows.get(lead.leadId);
    expect(row).toBeDefined();
    row!.triggeredAt = NOW.toISOString();

    const ledger = new MemoryConsumerLeadDeliveryLedger();
    ledger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    const deps = createOwnerEmailConsumerDeps(exchangeOwnerEmail, ledger, sendCount);
    const body = {
      type: "owner_email_due",
      sinkId: "sink-a",
      sinkKind: "email",
      sinkConfig: { to: "owner@example.com" },
      lead,
      details: { phone: null, jobTitle: "CTO", company: null, note: null },
      cardId: "card-1",
      cardSlug: "demo",
      sourceUrl: SOURCE_URL,
    };
    const message = {
      id: "defer-1",
      attempts: 1,
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await processLeadSinkQueueMessage(message, deps);
    expect(sendCount.value).toBe(0);
    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it("consumer acks duplicate owner email deliveries without sending twice", async () => {
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    await seedOwnerEmailExchangeRow(
      exchangeOwnerEmail,
      lead.leadId,
      "card-1",
      NOW.toISOString(),
    );
    const consumerLedger = new MemoryConsumerLeadDeliveryLedger();
    consumerLedger.seedQueued(lead.leadId, "sink-a", "record");
    const sendCount = { value: 0 };
    const deps = createOwnerEmailConsumerDeps(
      exchangeOwnerEmail,
      consumerLedger,
      sendCount,
    );
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
});
