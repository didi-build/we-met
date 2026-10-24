import { describe, expect, it } from "vitest";
import { MemoryExchangeOwnerEmailStore } from "@/exchange-owner-email/memory-store";
import { OWNER_EMAIL_SEND_CLAIM_STALE_MS } from "@/exchange-owner-email/types";

describe("MemoryExchangeOwnerEmailStore claims (unit)", () => {
  it("allows stale owner email claim takeover", async () => {
    const store = new MemoryExchangeOwnerEmailStore();
    const createdAt = "2026-10-12T12:00:00.000Z";
    await store.ensurePending({ leadId: "lead-1", cardId: "card-1", createdAt });

    const freshClaimAt = "2026-10-12T12:05:00.000Z";
    const staleBefore = new Date(
      Date.parse(freshClaimAt) - OWNER_EMAIL_SEND_CLAIM_STALE_MS,
    ).toISOString();

    const first = await store.tryClaimOwnerEmailSend(
      "lead-1",
      "2026-10-12T12:01:00.000Z",
      staleBefore,
    );
    expect(first).toBe("claimed");

    const contention = await store.tryClaimOwnerEmailSend(
      "lead-1",
      freshClaimAt,
      staleBefore,
    );
    expect(contention).toBe("contention");

    const staleClaimAt = new Date(
      Date.parse(freshClaimAt) + OWNER_EMAIL_SEND_CLAIM_STALE_MS + 1,
    ).toISOString();
    const staleBeforeAfterWait = new Date(
      Date.parse(staleClaimAt) - OWNER_EMAIL_SEND_CLAIM_STALE_MS,
    ).toISOString();

    const takeover = await store.tryClaimOwnerEmailSend(
      "lead-1",
      staleClaimAt,
      staleBeforeAfterWait,
    );
    expect(takeover).toBe("claimed");
  });

  it("allows stale visitor letter claim takeover", async () => {
    const store = new MemoryExchangeOwnerEmailStore();
    const createdAt = "2026-10-12T12:00:00.000Z";
    await store.ensurePending({ leadId: "lead-1", cardId: "card-1", createdAt });

    const claimAt = "2026-10-12T12:10:00.000Z";
    const staleBefore = new Date(
      Date.parse(claimAt) - OWNER_EMAIL_SEND_CLAIM_STALE_MS,
    ).toISOString();

    const first = await store.tryClaimVisitorLetterSend(
      "lead-1",
      "2026-10-12T12:01:00.000Z",
      staleBefore,
    );
    expect(first).toBe("claimed");

    const takeoverAt = new Date(
      Date.parse(claimAt) + OWNER_EMAIL_SEND_CLAIM_STALE_MS + 1,
    ).toISOString();
    const staleBeforeTakeover = new Date(
      Date.parse(takeoverAt) - OWNER_EMAIL_SEND_CLAIM_STALE_MS,
    ).toISOString();

    const takeover = await store.tryClaimVisitorLetterSend(
      "lead-1",
      takeoverAt,
      staleBeforeTakeover,
    );
    expect(takeover).toBe("claimed");
  });
});
