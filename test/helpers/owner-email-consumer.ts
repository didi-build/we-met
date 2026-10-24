import { vi } from "vitest";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import type { LeadSinkConsumerDeps } from "@/followup-email-consumer/process-lead-sink";
import { createFakeLeadSinkHandler } from "../followup-email-consumer/fake-lead-sink-handler";
import { MemoryConsumerLeadDeliveryLedger } from "../followup-email-consumer/memory-consumer-ledger";
import { leadEmailControlsFixture } from "./lead-email-deps";

export async function seedOwnerEmailExchangeRow(
  store: MemoryExchangeOwnerEmailStore,
  leadId: string,
  cardId: string,
  createdAt: string,
): Promise<void> {
  await store.ensurePending({ leadId, cardId, createdAt });
}

export function createOwnerEmailConsumerDeps(
  exchangeOwnerEmail: MemoryExchangeOwnerEmailStore,
  ledger: MemoryConsumerLeadDeliveryLedger,
  sendCount: { value: number },
  overrides: Partial<LeadSinkConsumerDeps> = {},
): LeadSinkConsumerDeps {
  const handler = createFakeLeadSinkHandler({
    deliverOwnerEmail: async () => {
      sendCount.value += 1;
      return {
        externalRef: JSON.stringify({ provider: "cloudflare", messageId: "m1" }),
      };
    },
  });
  return {
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
    now: () => new Date("2026-10-12T12:00:00.000Z"),
    ...overrides,
  };
}
