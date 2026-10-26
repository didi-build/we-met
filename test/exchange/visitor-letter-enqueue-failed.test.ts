import { describe, expect, it, vi } from "vitest";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { processOwnerEmailFinalize } from "@/exchange/process-owner-email-finalize";
import * as relayContactCardToken from "@/exchange/relay-contact-card-token";
import type { LeadSinkRecord } from "@/card-data/types";
import type { VisitorLead } from "@/exchange/types";
import { exampleCardInput } from "../helpers/example-card";

const lead: VisitorLead = {
  leadId: "lead-enqueue-log",
  submittedAt: "2026-10-12T12:00:00.000Z",
  environment: "local",
  isTestLead: true,
  name: "Alex Visitor",
  email: "visitor@example.com",
  phone: null,
};

function sink(): LeadSinkRecord {
  return {
    id: "sink-a",
    cardId: "card-1",
    kind: "email",
    config: { to: "owner@example.com" },
    enabled: true,
    createdAt: "",
    updatedAt: "",
  };
}

describe("exchange_visitor_letter_enqueue_failed (unit)", () => {
  it("logs on finalize when immediate visitor letter enqueue fails", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const logEnqueueFailed = vi.fn();
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();

    const result = await processOwnerEmailFinalize(lead, null, card, [sink()], {
      tokenSecret: "test-secret",
      resolveVisitorEmailMode: async (): Promise<VisitorEmailMode> => "owner_relay",
      followupQueue: {
        enqueueVisitorLetter: async () => {
          throw new Error("missing binding");
        },
      },
      leadSinkQueue: { enqueueLeadSink: async () => undefined },
      deliveryLedger: new MemoryLeadDeliveryLedger(),
      deliveryLogger: {
        logLedgerWriteFailed: vi.fn(),
        logLedgerEnqueueFailed: vi.fn(),
      },
      leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
      exchangeOwnerEmail,
      createLedgerId: () => "ledger-1",
      now: () => new Date("2026-10-12T12:00:00.000Z"),
      baseUrl: "https://we-met.link",
      logExchangeVisitorLetterEnqueueFailed: logEnqueueFailed,
    });

    expect(result.status).toBe("success");
    expect(logEnqueueFailed).toHaveBeenCalledOnce();
    expect(logEnqueueFailed).toHaveBeenCalledWith(lead.leadId);
  });

  it("finalizes without relay token when resolveVisitorEmailMode rejects", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    let enqueued: { relayContactCardToken?: string } | undefined;

    const result = await processOwnerEmailFinalize(lead, null, card, [sink()], {
      tokenSecret: "test-secret",
      resolveVisitorEmailMode: async () => {
        throw new Error("d1 unavailable");
      },
      followupQueue: {
        enqueueVisitorLetter: async (message) => {
          enqueued = message;
        },
      },
      leadSinkQueue: { enqueueLeadSink: async () => undefined },
      deliveryLedger: new MemoryLeadDeliveryLedger(),
      deliveryLogger: {
        logLedgerWriteFailed: vi.fn(),
        logLedgerEnqueueFailed: vi.fn(),
      },
      leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
      exchangeOwnerEmail,
      createLedgerId: () => "ledger-1",
      now: () => new Date("2026-10-12T12:00:00.000Z"),
      baseUrl: "https://we-met.link",
      logExchangeVisitorLetterEnqueueFailed: vi.fn(),
    });

    expect(result.status).toBe("success");
    expect(enqueued?.relayContactCardToken).toBeUndefined();
    const retry = await processOwnerEmailFinalize(lead, null, card, [sink()], {
      tokenSecret: "test-secret",
      resolveVisitorEmailMode: async () => {
        throw new Error("d1 unavailable");
      },
      followupQueue: {
        enqueueVisitorLetter: async () => undefined,
      },
      leadSinkQueue: { enqueueLeadSink: async () => undefined },
      deliveryLedger: new MemoryLeadDeliveryLedger(),
      deliveryLogger: {
        logLedgerWriteFailed: vi.fn(),
        logLedgerEnqueueFailed: vi.fn(),
      },
      leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
      exchangeOwnerEmail,
      createLedgerId: () => "ledger-2",
      now: () => new Date("2026-10-12T12:01:00.000Z"),
      baseUrl: "https://we-met.link",
      logExchangeVisitorLetterEnqueueFailed: vi.fn(),
    });
    expect(retry.status).toBe("already_finalized");
  });
});

function logPayloadDoesNotLeakSecrets(calls: unknown[][], secrets: string[]): void {
  const serialized = JSON.stringify(calls);
  for (const secret of secrets) {
    expect(serialized).not.toContain(secret);
  }
}

describe("relay_contact_card_token_failed (unit)", () => {
  it("logs once in owner_relay when relay token mint throws and omits secrets", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    const tokenSecret = "finalize-token-secret";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      relayContactCardToken,
      "relayContactCardTokenForEnqueue",
    ).mockImplementation(() => {
      throw new Error("mint failed");
    });

    await processOwnerEmailFinalize(lead, null, card, [sink()], {
      tokenSecret,
      resolveVisitorEmailMode: async (): Promise<VisitorEmailMode> => "owner_relay",
      followupQueue: { enqueueVisitorLetter: async () => undefined },
      leadSinkQueue: { enqueueLeadSink: async () => undefined },
      deliveryLedger: new MemoryLeadDeliveryLedger(),
      deliveryLogger: {
        logLedgerWriteFailed: vi.fn(),
        logLedgerEnqueueFailed: vi.fn(),
      },
      leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
      exchangeOwnerEmail,
      createLedgerId: () => "ledger-1",
      now: () => new Date("2026-10-12T12:00:00.000Z"),
      baseUrl: "https://we-met.link",
      logExchangeVisitorLetterEnqueueFailed: vi.fn(),
    });

    const relayLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_contact_card_token_failed",
    );
    expect(relayLogs).toHaveLength(1);
    expect(relayLogs[0]?.[1]).toEqual({ leadId: lead.leadId, cardId: card.id });
    logPayloadDoesNotLeakSecrets(errorSpy.mock.calls, [tokenSecret, "mint failed"]);
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("does not log when visitor email mode is direct", async () => {
    const repo = new MemoryCardRepository();
    const card = await repo.upsertCard(exampleCardInput());
    const exchangeOwnerEmail = new MemoryExchangeOwnerEmailStore();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await processOwnerEmailFinalize(lead, null, card, [sink()], {
      tokenSecret: "finalize-token-secret",
      resolveVisitorEmailMode: async (): Promise<VisitorEmailMode> => "direct",
      followupQueue: { enqueueVisitorLetter: async () => undefined },
      leadSinkQueue: { enqueueLeadSink: async () => undefined },
      deliveryLedger: new MemoryLeadDeliveryLedger(),
      deliveryLogger: {
        logLedgerWriteFailed: vi.fn(),
        logLedgerEnqueueFailed: vi.fn(),
      },
      leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
      exchangeOwnerEmail,
      createLedgerId: () => "ledger-1",
      now: () => new Date("2026-10-12T12:00:00.000Z"),
      baseUrl: "https://we-met.link",
      logExchangeVisitorLetterEnqueueFailed: vi.fn(),
    });

    const relayLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_contact_card_token_failed",
    );
    expect(relayLogs).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
