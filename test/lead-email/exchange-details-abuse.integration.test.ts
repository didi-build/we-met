import { describe, expect, it, vi } from "vitest";
import {
  APP_SETTING_DAILY_CAP_GLOBAL,
  APP_SETTING_DAILY_CAP_PER_CARD,
  APP_SETTING_LEAD_EMAIL_ENABLED,
} from "@/app-settings/defaults";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { createLeadDeliveryLedgerFromD1 } from "@/lead-delivery-ledger/d1-repository";
import { assertLeadEmailCapacity } from "@/lead-email/availability";
import { processDetails } from "@/exchange/process-details";
import { processExchange } from "@/exchange/process-exchange";
import { createDetailsToken } from "@/exchange/token";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

async function seedSettings(
  db: D1Database,
  rows: Record<string, string>,
): Promise<void> {
  for (const [key, value] of Object.entries(rows)) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(key, value)
      .run();
  }
}

type D1Database = import("@cloudflare/workers-types").D1Database;

function exchangeDeps(
  db: D1Database,
  sinkMessages: unknown[],
  ledgerMessages?: {
    followup: unknown[];
  },
) {
  const ledger = createLeadDeliveryLedgerFromD1(db);
  const now = () => new Date("2026-10-16T12:00:00.000Z");
  const followup: unknown[] = ledgerMessages?.followup ?? [];
  return {
    turnstile: { verify: async () => ({ success: true }) },
    rateLimiter: { check: async () => ({ allowed: true }) },
    followupQueue: {
      enqueueVisitorFollowup: async (message: unknown) => {
        followup.push(message);
      },
    },
    leadSinkQueue: {
      enqueueLeadSink: async (message: unknown) => {
        sinkMessages.push(message);
      },
    },
    deliveryLedger: ledger,
    deliveryLogger: {
      logLedgerWriteFailed: vi.fn(),
      logLedgerEnqueueFailed: vi.fn(),
    },
    tokenSecret: "secret",
    environment: "preview",
    clientIp: "203.0.113.1",
    leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
    createLeadId: () => "lead-abuse-1",
    createLedgerId: () => "ledger-abuse-1",
    now,
    baseUrl: "https://we-met.link",
    assertLeadEmailCapacity: (cardId: string, needed: number) =>
      assertLeadEmailCapacity(db, cardId, needed, now()),
    incrementDailySendCounts: async () => undefined,
    _followup: followup,
  };
}

describe("exchange and details abuse controls (D1 integration)", () => {
  it("returns lead_email_unavailable with no ledger, queue, or counters when paused", async () => {
    await withIsolatedLocalD1(async (db) => {
      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "0",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      const sinks = [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "email",
          config: { to: "owner@example.com" },
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ];
      const sinkMessages: unknown[] = [];
      const deps = exchangeDeps(db, sinkMessages);

      const result = await processExchange(
        {
          slug: card.slug,
          name: "Visitor",
          email: "visitor@example.com",
          phone: null,
          turnstileToken: "tok",
        },
        card,
        sinks,
        deps,
      );

      expect(result.status).toBe("lead_email_unavailable");
      expect(sinkMessages).toHaveLength(0);
      expect(deps._followup).toHaveLength(0);
      const ledgerCount = await db
        .prepare("SELECT COUNT(*) AS c FROM lead_delivery_ledger")
        .first<{ c: number }>();
      expect(ledgerCount?.c).toBe(0);
      const counterCount = await db
        .prepare("SELECT COUNT(*) AS c FROM daily_send_counts")
        .first<{ c: number }>();
      expect(counterCount?.c).toBe(0);
    });
  });

  it("rejects exchange at per-card cap minus one but allows details", async () => {
    await withIsolatedLocalD1(async (db) => {
      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "1",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "10",
      });
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      await db
        .prepare(
          `INSERT INTO daily_send_counts (day, card_id, kind, count) VALUES (?, ?, 'owner', 5)`,
        )
        .bind("2026-10-16", card.id)
        .run();
      await db
        .prepare(
          `INSERT INTO daily_send_counts (day, card_id, kind, count) VALUES (?, ?, 'visitor', 4)`,
        )
        .bind("2026-10-16", card.id)
        .run();

      const sinks = [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "email",
          config: { to: "owner@example.com" },
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ];
      const sinkMessages: unknown[] = [];
      const deps = exchangeDeps(db, sinkMessages);
      const exchange = await processExchange(
        {
          slug: card.slug,
          name: "Visitor",
          email: "visitor@example.com",
          phone: null,
          turnstileToken: "tok",
        },
        card,
        sinks,
        deps,
      );
      expect(exchange.status).toBe("lead_email_unavailable");

      const token = createDetailsToken(
        "secret",
        {
          leadId: "lead-abuse-1",
          cardId: card.id,
          cardSlug: card.slug,
          visitorEmail: "visitor@example.com",
          visitorName: "Visitor",
        },
        Math.floor(new Date("2026-10-16T12:00:00.000Z").getTime() / 1000),
      );
      const details = await processDetails(
        { token, jobTitle: "CTO", company: "Co", note: "Hi" },
        card,
        sinks,
        {
          tokenSecret: "secret",
          environment: "preview",
          leadSinkQueue: deps.leadSinkQueue,
          deliveryLedger: deps.deliveryLedger,
          deliveryLogger: deps.deliveryLogger,
          leadSinkLogger: deps.leadSinkLogger,
          createLedgerId: () => "ledger-details-1",
          now: deps.now,
          baseUrl: "https://we-met.link",
          assertLeadEmailCapacity: deps.assertLeadEmailCapacity,
        },
      );
      expect(details.status).toBe("success");
    });
  });

  it("increments owner and visitor counts with the ledger row on exchange", async () => {
    await withIsolatedLocalD1(async (db) => {
      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "1",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      const sinks = [
        {
          id: "sink-1",
          cardId: card.id,
          kind: "email",
          config: { to: "owner@example.com" },
          enabled: true,
          createdAt: "",
          updatedAt: "",
        },
      ];
      const sinkMessages: unknown[] = [];
      const deps = exchangeDeps(db, sinkMessages);
      const result = await processExchange(
        {
          slug: card.slug,
          name: "Visitor",
          email: "visitor@example.com",
          phone: null,
          turnstileToken: "tok",
        },
        card,
        sinks,
        deps,
      );
      expect(result.status).toBe("success");
      const owner = await db
        .prepare(
          `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'owner'`,
        )
        .bind("2026-10-16", card.id)
        .first<{ count: number }>();
      const visitor = await db
        .prepare(
          `SELECT count FROM daily_send_counts WHERE day = ? AND card_id = ? AND kind = 'visitor'`,
        )
        .bind("2026-10-16", card.id)
        .first<{ count: number }>();
      expect(owner?.count).toBe(1);
      expect(visitor?.count).toBe(1);
    });
  });

  it("still runs turnstile before lead email checks", async () => {
    await withIsolatedLocalD1(async (db) => {
      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "0",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      const sinkMessages: unknown[] = [];
      const deps = exchangeDeps(db, sinkMessages);
      deps.turnstile = { verify: async () => ({ success: false }) };
      const result = await processExchange(
        {
          slug: card.slug,
          name: "Visitor",
          email: "visitor@example.com",
          phone: null,
          turnstileToken: "tok",
        },
        card,
        [],
        deps,
      );
      expect(result.status).toBe("turnstile_failed");
    });
  });
});
