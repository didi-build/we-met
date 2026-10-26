import { describe, expect, it, vi } from "vitest";
import * as relayContactCardToken from "@/exchange/relay-contact-card-token";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { exampleCardInput } from "../helpers/example-card";
import { processExchange } from "@/exchange/process-exchange";
import type { ProcessExchangeDeps } from "@/exchange/process-exchange";
import type { ValidatedExchangeInput } from "@/exchange/validation";
import { leadEmailCapacityAlwaysAllowed } from "../helpers/lead-email-deps";

function baseInput(
  overrides: Partial<ValidatedExchangeInput> = {},
): ValidatedExchangeInput {
  return {
    slug: "demo",
    name: "Test Visitor",
    email: "visitor@example.com",
    turnstileToken: "token",
    ...overrides,
  };
}

function createDeps(
  overrides: Partial<ProcessExchangeDeps> = {},
): ProcessExchangeDeps & {
  followupMessages: unknown[];
  sinkMessages: unknown[];
} {
  const followupMessages: unknown[] = [];
  const sinkMessages: unknown[] = [];
  const deliveryLedger = overrides.deliveryLedger ?? new MemoryLeadDeliveryLedger();
  const deps: ProcessExchangeDeps = {
    turnstile: { verify: async () => ({ success: true }) },
    rateLimiter: { check: async () => ({ allowed: true }) },
    followupQueue: {
      enqueueVisitorLetter: async (message) => {
        followupMessages.push(message);
      },
    },
    leadSinkQueue: {
      enqueueLeadSink: async (message) => {
        sinkMessages.push(message);
      },
    },
    tokenSecret: "test-secret",
    environment: "local",
    clientIp: "203.0.113.1",
    leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
    deliveryLedger,
    exchangeOwnerEmail:
      overrides.exchangeOwnerEmail ?? new MemoryExchangeOwnerEmailStore(),
    deliveryLogger: {
      logLedgerWriteFailed: vi.fn(),
      logLedgerEnqueueFailed: vi.fn(),
    },
    createLeadId: () => "lead-1",
    createLedgerId: () => "ledger-1",
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    baseUrl: "https://we-met.link",
    logExchangeVisitorLetterEnqueueFailed: vi.fn(),
    resolveVisitorEmailMode: async () => "owner_relay",
    ...leadEmailCapacityAlwaysAllowed,
    ...overrides,
  };
  return { ...deps, followupMessages, sinkMessages };
}

describe("processExchange (unit)", () => {
  it("returns rate_limited before lead email capacity is checked", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const capacityCheck = vi.fn(async () => true);
    const deps = createDeps({
      rateLimiter: { check: async () => ({ allowed: false }) },
      assertLeadEmailCapacity: capacityCheck,
    });
    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("rate_limited");
    expect(capacityCheck).not.toHaveBeenCalled();
  });

  it("enqueues visitor follow-up and returns a token on success", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps();

    const result = await processExchange(baseInput(), card, [], deps);

    expect(result.status).toBe("success");
    expect(deps.followupMessages).toHaveLength(1);
    expect(deps.sinkMessages).toHaveLength(0);
    const msg = deps.followupMessages[0] as {
      type: string;
      lead: { isTestLead: boolean };
    };
    expect(msg.type).toBe("visitor_letter_due");
    expect(msg.lead.isTestLead).toBe(true);
    if (result.status === "success") {
      expect(result.body.token.length).toBeGreaterThan(10);
      expect(result.body.ownerEmail).toBe(card.email);
      expect(result.body.ownerPhone).toBe(card.contact.phone);
    }
  });

  it("omits ownerPhone when the card has no phone", async () => {
    const repo = new MemoryCardRepository();
    const input = exampleCardInput();
    const card = await repo.upsertCard({
      ...input,
      contact: { ...input.contact, phone: "   " },
    });
    const deps = createDeps();

    const result = await processExchange(baseInput(), card, [], deps);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.body.ownerEmail).toBe(card.email);
      expect(result.body).not.toHaveProperty("ownerPhone");
    }
  });

  it("returns card_not_found when the card is missing", async () => {
    const deps = createDeps();
    const result = await processExchange(baseInput(), null, [], deps);
    expect(result.status).toBe("card_not_found");
  });

  it("returns lead_email_unavailable when capacity is exhausted", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      assertLeadEmailCapacity: async () => false,
    });
    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("lead_email_unavailable");
    expect(deps.followupMessages).toHaveLength(0);
  });

  it("does not return owner fields on turnstile_failed", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      turnstile: { verify: async () => ({ success: false }) },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("turnstile_failed");
    expect(result).not.toHaveProperty("body");
  });

  it("does not return owner fields on rate_limited", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      rateLimiter: { check: async () => ({ allowed: false }) },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("rate_limited");
    expect(result).not.toHaveProperty("body");
  });

  it("does not return owner fields on enqueue_failed", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      followupQueue: {
        enqueueVisitorLetter: async () => {
          throw new Error("missing binding");
        },
      },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("enqueue_failed");
    expect(result).not.toHaveProperty("body");
  });

  it("rejects failed Turnstile", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      turnstile: { verify: async () => ({ success: false }) },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("turnstile_failed");
    expect(deps.followupMessages).toHaveLength(0);
  });

  it("rejects rate limited clients", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      rateLimiter: { check: async () => ({ allowed: false }) },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("rate_limited");
  });

  it("enqueues one sink message per enabled sink", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinks = [
      {
        id: "sink-a",
        cardId: card.id,
        kind: "test_sink",
        config: { to: "a@example.com" },
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "sink-b",
        cardId: card.id,
        kind: "test_sink",
        config: { to: "b@example.com" },
        enabled: false,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const deps = createDeps();

    await processExchange(baseInput(), card, sinks, deps);

    expect(deps.sinkMessages).toHaveLength(1);
    expect(deps.followupMessages).toHaveLength(1);
  });

  it("does not fail exchange when one sink enqueue fails", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinks = [
      {
        id: "sink-a",
        cardId: card.id,
        kind: "test_sink",
        config: {},
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "sink-b",
        cardId: card.id,
        kind: "test_sink",
        config: {},
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const logSinkEnqueueFailure = vi.fn();
    const sinkMessages: unknown[] = [];
    const deps = createDeps({
      leadSinkLogger: { logSinkEnqueueFailure },
      leadSinkQueue: {
        enqueueLeadSink: async (message) => {
          if ((message as { sinkId: string }).sinkId === "sink-a") {
            throw new Error("queue down");
          }
          sinkMessages.push(message);
        },
      },
    });

    const result = await processExchange(baseInput(), card, sinks, deps);
    expect(result.status).toBe("success");
    expect(logSinkEnqueueFailure).toHaveBeenCalledOnce();
    expect(sinkMessages).toHaveLength(1);
  });

  it("enqueues relay contact card token on visitor_letter_due when mode is owner_relay", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      resolveVisitorEmailMode: async () => "owner_relay",
    });
    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("success");
    const message = deps.followupMessages[0] as {
      relayContactCardToken?: string;
    };
    expect(message.relayContactCardToken).toBeTruthy();
  });

  it("does not enqueue relay contact card token when mode is direct", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      resolveVisitorEmailMode: async () => "direct",
    });
    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("success");
    const message = deps.followupMessages[0] as {
      relayContactCardToken?: string;
    };
    expect(message.relayContactCardToken).toBeUndefined();
  });

  it("logs mode read failure and enqueues no relay token when visitor email mode read fails on exchange", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = createDeps({
      resolveVisitorEmailMode: async () => {
        throw new Error("d1 unavailable");
      },
    });
    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("success");
    const message = deps.followupMessages[0] as {
      relayContactCardToken?: string;
    };
    expect(message.relayContactCardToken).toBeUndefined();
    const modeLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "visitor_email_mode_read_failed",
    );
    expect(modeLogs).toHaveLength(1);
    expect(modeLogs[0]?.[1]).toEqual({ leadId: "lead-1" });
    errorSpy.mockRestore();
  });

  it("logs relay_contact_card_token_failed when mint throws on exchange", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      relayContactCardToken,
      "relayContactCardTokenForEnqueue",
    ).mockImplementation(() => {
      throw new Error("mint failed");
    });
    const deps = createDeps({
      resolveVisitorEmailMode: async () => "owner_relay",
    });
    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("success");
    const message = deps.followupMessages[0] as {
      relayContactCardToken?: string;
    };
    expect(message.relayContactCardToken).toBeUndefined();
    const mintLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_contact_card_token_failed",
    );
    expect(mintLogs).toHaveLength(1);
    expect(mintLogs[0]?.[1]).toEqual({ leadId: "lead-1" });
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("in owner_relay enqueues delayed visitor letter, reserves two cap slots, and counts owner and visitor", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinks = [
      {
        id: "sink-a",
        cardId: card.id,
        kind: "test_sink",
        config: { to: "owner@example.com" },
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const capacityCheck = vi.fn(async () => true);
    const incrementDailySendCounts = vi.fn(async () => {});
    const deps = createDeps({
      assertLeadEmailCapacity: capacityCheck,
      incrementDailySendCounts,
    });

    const result = await processExchange(baseInput(), card, sinks, deps);

    expect(result.status).toBe("success");
    expect(capacityCheck).toHaveBeenCalledWith(card.id, 2);
    expect(deps.followupMessages).toHaveLength(1);
    expect((deps.followupMessages[0] as { type: string }).type).toBe(
      "visitor_letter_due",
    );
    expect(deps.sinkMessages).toHaveLength(1);
    expect(incrementDailySendCounts).not.toHaveBeenCalled();
    if (result.status === "success") {
      expect(result.body.token.length).toBeGreaterThan(10);
    }
  });

  it("with no sinks increments owner and visitor counts", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const incrementDailySendCounts = vi.fn(async () => {});
    const deps = createDeps({
      incrementDailySendCounts,
    });

    const result = await processExchange(baseInput(), card, [], deps);

    expect(result.status).toBe("success");
    expect(deps.followupMessages).toHaveLength(1);
    expect(incrementDailySendCounts).toHaveBeenCalledWith(card.id, [
      "owner",
      "visitor",
    ]);
  });

  it("fails when visitor follow-up enqueue fails", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      followupQueue: {
        enqueueVisitorLetter: async () => {
          throw new Error("missing binding");
        },
      },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("enqueue_failed");
  });

  it("enqueues visitor_letter_due before owner_email_due on exchange", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinks = [
      {
        id: "sink-a",
        cardId: card.id,
        kind: "test_sink",
        config: { to: "owner@example.com" },
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const callOrder: string[] = [];
    const deps = createDeps({
      followupQueue: {
        enqueueVisitorLetter: async () => {
          callOrder.push("visitor_letter_due");
        },
      },
      leadSinkQueue: {
        enqueueLeadSink: async (message) => {
          callOrder.push((message as { type: string }).type);
        },
      },
    });

    const result = await processExchange(baseInput(), card, sinks, deps);

    expect(result.status).toBe("success");
    expect(callOrder).toEqual(["visitor_letter_due", "owner_email_due"]);
  });

  it("logs exchange_visitor_letter_enqueue_failed when visitor letter enqueue fails on exchange", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const logEnqueueFailed = vi.fn();
    const deps = createDeps({
      logExchangeVisitorLetterEnqueueFailed: logEnqueueFailed,
      followupQueue: {
        enqueueVisitorLetter: async () => {
          throw new Error("missing binding");
        },
      },
    });

    const result = await processExchange(baseInput(), card, [], deps);

    expect(result.status).toBe("enqueue_failed");
    expect(logEnqueueFailed).toHaveBeenCalledOnce();
    expect(logEnqueueFailed).toHaveBeenCalledWith("lead-1");
  });

  it("does not enqueue owner_email_due or cap counts when visitor letter enqueue fails", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinks = [
      {
        id: "sink-a",
        cardId: card.id,
        kind: "test_sink",
        config: { to: "owner@example.com" },
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const deliveryLedger = new MemoryLeadDeliveryLedger();
    const incrementDailySendCounts = vi.fn(async () => {});
    const deps = createDeps({
      deliveryLedger,
      incrementDailySendCounts,
      followupQueue: {
        enqueueVisitorLetter: async () => {
          throw new Error("missing binding");
        },
      },
    });

    const result = await processExchange(baseInput(), card, sinks, deps);

    expect(result.status).toBe("enqueue_failed");
    expect(deps.sinkMessages).toHaveLength(0);
    expect(deliveryLedger.rows).toHaveLength(0);
    expect(incrementDailySendCounts).not.toHaveBeenCalled();
  });
});
