import { describe, expect, it, vi } from "vitest";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { processOwnerEmailFinalize } from "@/exchange/process-owner-email-finalize";
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
});
