import { describe, expect, it, vi } from "vitest";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { exampleCardInput } from "../helpers/example-card";
import { processExchange } from "@/exchange/process-exchange";
import type { ProcessExchangeDeps } from "@/exchange/process-exchange";
import type { ValidatedExchangeInput } from "@/exchange/validation";

function baseInput(
  overrides: Partial<ValidatedExchangeInput> = {},
): ValidatedExchangeInput {
  return {
    slug: "demo",
    name: "Test Visitor",
    email: "visitor@example.com",
    phone: null,
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
  const deps: ProcessExchangeDeps = {
    turnstile: { verify: async () => ({ success: true }) },
    rateLimiter: { check: async () => ({ allowed: true }) },
    followupQueue: {
      enqueueVisitorFollowup: async (message) => {
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
    createLeadId: () => "lead-1",
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    ...overrides,
  };
  return { ...deps, followupMessages, sinkMessages };
}

describe("processExchange (unit)", () => {
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
    expect(msg.type).toBe("visitor_followup");
    expect(msg.lead.isTestLead).toBe(true);
    if (result.status === "success") {
      expect(result.body.token.length).toBeGreaterThan(10);
    }
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

  it("fails when visitor follow-up enqueue fails", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const deps = createDeps({
      followupQueue: {
        enqueueVisitorFollowup: async () => {
          throw new Error("missing binding");
        },
      },
    });

    const result = await processExchange(baseInput(), card, [], deps);
    expect(result.status).toBe("enqueue_failed");
  });
});
