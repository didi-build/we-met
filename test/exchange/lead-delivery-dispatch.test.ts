import { describe, expect, it, vi } from "vitest";
import { MemoryLeadDeliveryLedger } from "@/lead-delivery-ledger/memory-repository";
import { FOLLOWUP_RETRY_RETENTION_BUDGET_SECONDS } from "../../scripts/lib/queue-retry-policy.mjs";
import {
  dispatchDetailsAppend,
  dispatchLeadOnExchange,
  type LeadSinkDispatchDeps,
} from "@/exchange/lead-sink/dispatcher";
import type { LeadSinkRecord } from "@/card-data/types";
import type { VisitorLead } from "@/exchange/types";

const NOW = new Date("2026-10-12T12:00:00.000Z");

const SOURCE_URL = "https://we-met.link/hi/demo";

const lead: VisitorLead = {
  leadId: "lead-1",
  submittedAt: NOW.toISOString(),
  environment: "local",
  isTestLead: true,
  name: "Visitor",
  email: "visitor@example.com",
  phone: null,
};

function sink(id: string, to: string, enabled = true): LeadSinkRecord {
  return {
    id,
    cardId: "card-1",
    kind: "email",
    config: { to },
    enabled,
    createdAt: "",
    updatedAt: "",
  };
}

function createDispatchDeps(
  overrides: Partial<LeadSinkDispatchDeps> & {
    sinkMessages?: unknown[];
    failingSinkIds?: Set<string>;
    ledger?: MemoryLeadDeliveryLedger;
  } = {},
): LeadSinkDispatchDeps & {
  sinkMessages: unknown[];
  ledger: MemoryLeadDeliveryLedger;
  deliveryLogger: {
    logLedgerWriteFailed: ReturnType<typeof vi.fn>;
    logLedgerEnqueueFailed: ReturnType<typeof vi.fn>;
  };
} {
  const sinkMessages: unknown[] = overrides.sinkMessages ?? [];
  const ledger = overrides.ledger ?? new MemoryLeadDeliveryLedger();
  const deliveryLogger = {
    logLedgerWriteFailed: vi.fn(),
    logLedgerEnqueueFailed: vi.fn(),
  };
  const failing = overrides.failingSinkIds ?? new Set<string>();
  let ledgerSeq = 0;

  const base: LeadSinkDispatchDeps & {
    sinkMessages: unknown[];
    ledger: MemoryLeadDeliveryLedger;
    deliveryLogger: typeof deliveryLogger;
  } = {
    producer: {
      enqueueLeadSink: async (message) => {
        const sinkId = (message as { sinkId: string }).sinkId;
        if (failing.has(sinkId)) {
          throw new Error("queue down");
        }
        sinkMessages.push(message);
      },
    },
    sinkLogger: { logSinkEnqueueFailure: vi.fn() },
    ledger,
    deliveryLogger,
    now: () => NOW,
    createLedgerId: () => `ledger-${++ledgerSeq}`,
    sinkMessages,
  };
  return { ...base, ...overrides, ledger, sinkMessages, deliveryLogger };
}

describe("lead delivery dispatch (unit)", () => {
  it("writes one record ledger row per enabled sink including duplicate to addresses", async () => {
    const deps = createDispatchDeps();
    await dispatchLeadOnExchange(
      [sink("sink-a", "same@example.com"), sink("sink-b", "same@example.com")],
      lead,
      "card-1",
      "demo",
      SOURCE_URL,
      deps,
    );

    expect(deps.sinkMessages).toHaveLength(2);
    expect(deps.ledger.rows).toHaveLength(2);
    expect(deps.ledger.rows.every((r) => r.phase === "record")).toBe(true);
    expect(deps.ledger.rows.every((r) => r.status === "queued")).toBe(true);
    const retryUntil = new Date(
      NOW.getTime() + FOLLOWUP_RETRY_RETENTION_BUDGET_SECONDS * 1000,
    ).toISOString();
    expect(deps.ledger.rows[0]?.retryUntil).toBe(retryUntil);
  });

  it("writes no ledger rows when no sinks are enabled", async () => {
    const deps = createDispatchDeps();
    await dispatchLeadOnExchange([], lead, "card-1", "demo", SOURCE_URL, deps);
    expect(deps.ledger.rows).toHaveLength(0);
    expect(deps.sinkMessages).toHaveLength(0);
  });

  it("skips enqueue when ledger insert fails and logs ledger_write_failed", async () => {
    const ledger = new MemoryLeadDeliveryLedger();
    const insert = vi
      .spyOn(ledger, "insertQueuedRow")
      .mockRejectedValue(new Error("db"));
    const deps = createDispatchDeps({ ledger });

    await dispatchLeadOnExchange(
      [sink("sink-a", "a@example.com")],
      lead,
      "card-1",
      "demo",
      SOURCE_URL,
      deps,
    );

    expect(deps.sinkMessages).toHaveLength(0);
    expect(deps.deliveryLogger.logLedgerWriteFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-a",
      "ledger_write_failed",
    );
    insert.mockRestore();
  });

  it("marks ledger failed when enqueue fails after insert", async () => {
    const deps = createDispatchDeps({ failingSinkIds: new Set(["sink-a"]) });

    await dispatchLeadOnExchange(
      [sink("sink-a", "a@example.com")],
      lead,
      "card-1",
      "demo",
      SOURCE_URL,
      deps,
    );

    expect(deps.sinkMessages).toHaveLength(0);
    expect(deps.deliveryLogger.logLedgerEnqueueFailed).toHaveBeenCalledWith(
      "lead-1",
      "sink-a",
      "enqueue_failed",
    );
    expect(deps.ledger.rows[0]?.status).toBe("failed");
    expect(deps.ledger.rows[0]?.errorCode).toBe("enqueue_failed");
  });

  it("dispatchDetailsAppend reports inserted, already_exists, and failed outcomes", async () => {
    const deps = createDispatchDeps();
    const sinks = [sink("sink-a", "a@example.com")];
    const details = { phone: null, jobTitle: null, company: null, note: null };
    const appendLead = { leadId: lead.leadId, name: lead.name, email: lead.email };
    const submittedAt = NOW.toISOString();

    const first = await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      deps,
    );
    expect(first).toBe("inserted");

    const second = await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      deps,
    );
    expect(second).toBe("already_exists");

    const throwingLedger = {
      ...deps.ledger,
      insertAppendIfAbsent: async () => {
        throw new Error("d1");
      },
      insertAppendIfAbsentWithDailySendIncrements: async () => {
        throw new Error("d1");
      },
    };
    const failed = await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      { ...deps, ledger: throwingLedger },
    );
    expect(failed).toBe("failed");
  });

  it("details double submit enqueues append once per sink", async () => {
    const deps = createDispatchDeps();
    const sinks = [sink("sink-a", "a@example.com")];
    const details = { phone: null, jobTitle: "CTO", company: "Co", note: "Hi" };

    const appendLead = { leadId: lead.leadId, name: lead.name, email: lead.email };
    const submittedAt = NOW.toISOString();
    await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      deps,
    );
    await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      deps,
    );

    expect(deps.sinkMessages).toHaveLength(1);
    expect(deps.ledger.rows.filter((r) => r.phase === "append")).toHaveLength(1);
  });

  it("does not re-enqueue append after enqueue_failed left a row", async () => {
    const deps = createDispatchDeps({ failingSinkIds: new Set(["sink-a"]) });
    const sinks = [sink("sink-a", "a@example.com")];
    const details = { phone: null, jobTitle: null, company: null, note: null };

    const appendLead = { leadId: lead.leadId, name: lead.name, email: lead.email };
    const submittedAt = NOW.toISOString();
    await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      deps,
    );
    const failing = createDispatchDeps({ ledger: deps.ledger });
    await dispatchDetailsAppend(
      sinks,
      appendLead,
      details,
      "card-1",
      "demo",
      SOURCE_URL,
      submittedAt,
      failing,
    );

    expect(deps.sinkMessages).toHaveLength(0);
    expect(failing.sinkMessages).toHaveLength(0);
  });
});
