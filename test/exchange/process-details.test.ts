import { describe, expect, it, vi } from "vitest";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { processDetails } from "@/exchange/process-details";
import { createDetailsToken } from "@/exchange/token";
import { exampleCardInput } from "../helpers/example-card";

function detailsDeps(
  sinkMessages: unknown[],
  exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore(),
) {
  return {
    tokenSecret: "secret",
    environment: "local",
    followupQueue: { enqueueVisitorLetter: async () => undefined },
    leadSinkQueue: {
      enqueueLeadSink: async (message: unknown) => {
        sinkMessages.push(message);
      },
    },
    leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
    deliveryLedger: new MemoryLeadDeliveryLedger(),
    exchangeOwnerEmail,
    deliveryLogger: {
      logLedgerWriteFailed: vi.fn(),
      logLedgerEnqueueFailed: vi.fn(),
    },
    createLedgerId: () => "ledger-1",
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    baseUrl: "https://we-met.link",
    logExchangeVisitorLetterEnqueueFailed: vi.fn(),
  };
}

describe("processDetails (unit)", () => {
  it("dispatches lead_sink_owner_email sink messages", async () => {
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
      detailsDeps(sinkMessages),
    );

    expect(result.status).toBe("success");
    expect(sinkMessages).toHaveLength(1);
    expect((sinkMessages[0] as { type: string }).type).toBe("lead_sink_owner_email");
  });

  it("includes optional phone in owner email queue payload", async () => {
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
      detailsDeps(sinkMessages),
    );

    expect(result.status).toBe("success");
    const message = sinkMessages[0] as { details: { phone: string | null } };
    expect(message.details.phone).toBe("+1 416 555 0100");
  });

  it("rejects a second details submit for the same lead", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const sinkMessages: unknown[] = [];
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
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
    const deps = detailsDeps(sinkMessages, exchangeOwnerEmail);
    const input = { token, phone: null, jobTitle: "CTO", company: "Co", note: "Hi" };

    const first = await processDetails(input, card, sinks, deps);
    expect(first.status).toBe("success");
    expect(sinkMessages).toHaveLength(1);

    const second = await processDetails(
      { ...input, jobTitle: "CEO", company: "Other", note: "Changed" },
      card,
      sinks,
      deps,
    );
    expect(second.status).toBe("details_already_sent");
    expect(sinkMessages).toHaveLength(1);
  });

  it("rejects invalid tokens", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const result = await processDetails(
      { token: "bad", phone: null, jobTitle: null, company: null, note: null },
      card,
      [],
      detailsDeps([]),
    );
    expect(result.status).toBe("invalid_token");
  });
});
