import { describe, expect, it, vi } from "vitest";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { processDetails } from "@/exchange/process-details";
import { createDetailsToken } from "@/exchange/token";
import { exampleCardInput } from "../helpers/example-card";

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
      { token, jobTitle: "CTO", company: "Co", note: "Hi" },
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
      },
    );

    expect(result.status).toBe("success");
    expect(sinkMessages).toHaveLength(1);
    expect((sinkMessages[0] as { type: string }).type).toBe("lead_sink_append_details");
  });

  it("rejects invalid tokens", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const result = await processDetails(
      { token: "bad", jobTitle: null, company: null, note: null },
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
      },
    );
    expect(result.status).toBe("invalid_token");
  });
});
