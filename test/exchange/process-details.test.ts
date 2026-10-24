import { describe, expect, it, vi } from "vitest";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import type {
  DailySendCountIncrement,
  InsertQueuedLeadDeliveryInput,
  LeadDeliveryLedger,
} from "@/lead-delivery-ledger/types";
import { processDetails } from "@/exchange/process-details";
import { createDetailsToken } from "@/exchange/token";
import { exampleCardInput } from "../helpers/example-card";
import { leadEmailCapacityAlwaysAllowed } from "../helpers/lead-email-deps";

class AppendInsertThrowsLedger extends MemoryLeadDeliveryLedger {
  async hasAppendPhaseForLead(_leadId: string): Promise<boolean> {
    return false;
  }

  async insertAppendIfAbsent(_input: InsertQueuedLeadDeliveryInput): Promise<boolean> {
    throw new Error("d1_unavailable");
  }

  async insertAppendIfAbsentWithDailySendIncrements(
    _input: InsertQueuedLeadDeliveryInput,
    _increments: DailySendCountIncrement,
  ): Promise<boolean> {
    throw new Error("d1_unavailable");
  }
}

class AppendRaceLedger extends MemoryLeadDeliveryLedger {
  async hasAppendPhaseForLead(_leadId: string): Promise<boolean> {
    return false;
  }

  async insertAppendIfAbsent(_input: InsertQueuedLeadDeliveryInput): Promise<boolean> {
    return false;
  }

  async insertAppendIfAbsentWithDailySendIncrements(
    _input: InsertQueuedLeadDeliveryInput,
    _increments: DailySendCountIncrement,
  ): Promise<boolean> {
    return false;
  }
}

function detailsDeps(
  ledger: LeadDeliveryLedger,
  sinkMessages: unknown[],
  createLedgerId = () => "ledger-1",
) {
  return {
    tokenSecret: "secret",
    environment: "local",
    leadSinkQueue: {
      enqueueLeadSink: async (message: unknown) => {
        sinkMessages.push(message);
      },
    },
    leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
    deliveryLedger: ledger,
    deliveryLogger: {
      logLedgerWriteFailed: vi.fn(),
      logLedgerEnqueueFailed: vi.fn(),
    },
    createLedgerId,
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    baseUrl: "https://we-met.link",
    ...leadEmailCapacityAlwaysAllowed,
  };
}

describe("processDetails (unit)", () => {
  it("dispatches append-details sink messages", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinkMessages: unknown[] = [];
    const nowSeconds = Math.floor(
      new Date("2026-10-12T12:00:00.000Z").getTime() / 1000,
    );
    const token = createDetailsToken(
      "secret",
      {
        leadId: "lead-1",
        cardId: card.id,
        cardSlug: card.slug,
        visitorEmail: "visitor@example.com",
        visitorName: "Visitor",
      },
      nowSeconds,
    );

    const result = await processDetails(
      { token, phone: null, jobTitle: "CTO", company: "Co", note: "Hi" },
      card,
      [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "test_sink",
          config: {},
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      {
        tokenSecret: "secret",
        environment: "local",
        leadSinkQueue: {
          enqueueLeadSink: async (message) => {
            sinkMessages.push(message);
          },
        },
        leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
        deliveryLedger: new MemoryLeadDeliveryLedger(),
        deliveryLogger: {
          logLedgerWriteFailed: vi.fn(),
          logLedgerEnqueueFailed: vi.fn(),
        },
        createLedgerId: () => "ledger-1",
        now: () => new Date("2026-10-12T12:00:00.000Z"),
        baseUrl: "https://we-met.link",
        ...leadEmailCapacityAlwaysAllowed,
      },
    );

    expect(result.status).toBe("success");
    expect(sinkMessages).toHaveLength(1);
    expect((sinkMessages[0] as { type: string }).type).toBe("lead_sink_append_details");
  });

  it("includes optional phone in append-details queue payload", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinkMessages: unknown[] = [];
    const nowSeconds = Math.floor(
      new Date("2026-10-12T12:00:00.000Z").getTime() / 1000,
    );
    const token = createDetailsToken(
      "secret",
      {
        leadId: "lead-phone",
        cardId: card.id,
        cardSlug: card.slug,
        visitorEmail: "visitor@example.com",
        visitorName: "Visitor",
      },
      nowSeconds,
    );

    const result = await processDetails(
      {
        token,
        phone: "+1 416 555 0100",
        jobTitle: null,
        company: null,
        note: null,
      },
      card,
      [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "test_sink",
          config: {},
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      detailsDeps(new MemoryLeadDeliveryLedger(), sinkMessages),
    );

    expect(result.status).toBe("success");
    const message = sinkMessages[0] as { details: { phone: string | null } };
    expect(message.details.phone).toBe("+1 416 555 0100");
  });

  it("rejects a second details submit for the same lead", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinkMessages: unknown[] = [];
    const ledger = new MemoryLeadDeliveryLedger();
    const nowSeconds = Math.floor(
      new Date("2026-10-12T12:00:00.000Z").getTime() / 1000,
    );
    const token = createDetailsToken(
      "secret",
      {
        leadId: "lead-1",
        cardId: card.id,
        cardSlug: card.slug,
        visitorEmail: "visitor@example.com",
        visitorName: "Visitor",
      },
      nowSeconds,
    );
    const sinks = [
      {
        id: "sink-1",
        cardId: card.id,
        kind: "test_sink",
        config: {},
        enabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const deps = {
      tokenSecret: "secret",
      environment: "local",
      leadSinkQueue: {
        enqueueLeadSink: async (message: unknown) => {
          sinkMessages.push(message);
        },
      },
      leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
      deliveryLedger: ledger,
      deliveryLogger: {
        logLedgerWriteFailed: vi.fn(),
        logLedgerEnqueueFailed: vi.fn(),
      },
      createLedgerId: () => "ledger-1",
      now: () => new Date("2026-10-12T12:00:00.000Z"),
      baseUrl: "https://we-met.link",
      ...leadEmailCapacityAlwaysAllowed,
    };
    const input = { token, phone: null, jobTitle: "CTO", company: "Co", note: "Hi" };

    const first = await processDetails(input, card, sinks, deps);
    expect(first.status).toBe("success");
    expect(sinkMessages).toHaveLength(1);

    const second = await processDetails(
      { ...input, jobTitle: "CEO", company: "Other", note: "Changed" },
      card,
      sinks,
      { ...deps, createLedgerId: () => "ledger-2" },
    );
    expect(second.status).toBe("details_already_sent");
    expect(sinkMessages).toHaveLength(1);
    expect(ledger.rows.filter((r) => r.phase === "append")).toHaveLength(1);
  });

  it("returns server_error when append ledger insert throws", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinkMessages: unknown[] = [];
    const token = createDetailsToken(
      "secret",
      {
        leadId: "lead-1",
        cardId: card.id,
        cardSlug: card.slug,
        visitorEmail: "visitor@example.com",
        visitorName: "Visitor",
      },
      Math.floor(new Date("2026-10-12T12:00:00.000Z").getTime() / 1000),
    );

    const result = await processDetails(
      { token, phone: null, jobTitle: "CTO", company: null, note: null },
      card,
      [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "test_sink",
          config: {},
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      detailsDeps(new AppendInsertThrowsLedger(), sinkMessages),
    );

    expect(result.status).toBe("server_error");
    expect(sinkMessages).toHaveLength(0);
  });

  it("returns details_already_sent when pre-check misses but append insert conflicts", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinkMessages: unknown[] = [];
    const token = createDetailsToken(
      "secret",
      {
        leadId: "lead-1",
        cardId: card.id,
        cardSlug: card.slug,
        visitorEmail: "visitor@example.com",
        visitorName: "Visitor",
      },
      Math.floor(new Date("2026-10-12T12:00:00.000Z").getTime() / 1000),
    );

    const result = await processDetails(
      { token, phone: null, jobTitle: "CTO", company: null, note: null },
      card,
      [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "test_sink",
          config: {},
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
      detailsDeps(new AppendRaceLedger(), sinkMessages),
    );

    expect(result.status).toBe("details_already_sent");
    expect(sinkMessages).toHaveLength(0);
  });

  it("rejects invalid tokens", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const result = await processDetails(
      { token: "bad", phone: null, jobTitle: null, company: null, note: null },
      card,
      [],
      {
        tokenSecret: "secret",
        environment: "local",
        leadSinkQueue: { enqueueLeadSink: async () => {} },
        leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
        deliveryLedger: new MemoryLeadDeliveryLedger(),
        deliveryLogger: {
          logLedgerWriteFailed: vi.fn(),
          logLedgerEnqueueFailed: vi.fn(),
        },
        createLedgerId: () => "ledger-1",
        now: () => new Date(),
        baseUrl: "https://we-met.link",
        ...leadEmailCapacityAlwaysAllowed,
      },
    );
    expect(result.status).toBe("invalid_token");
  });
});
