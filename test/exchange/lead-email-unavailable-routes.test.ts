import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as exchangePost } from "@/app/api/exchange/route";
import { POST as detailsPost } from "@/app/api/details/route";
import {
  APP_SETTING_DAILY_CAP_GLOBAL,
  APP_SETTING_DAILY_CAP_PER_CARD,
  APP_SETTING_LEAD_EMAIL_ENABLED,
} from "@/app-settings/defaults";
import type { CardRecord } from "@/card-data/types";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { createLeadDeliveryLedgerFromD1 } from "@/lead-delivery-ledger/d1-repository";
import { readLeadEmailControls } from "@/app-settings/caps";
import { assertLeadEmailCapacity } from "@/lead-email/availability";
import { createDetailsToken } from "@/exchange/token";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  headerMap: new Map<string, string>(),
  env: {} as Record<string, unknown>,
  repo: null as unknown as MemoryCardRepository,
  card: null as unknown as CardRecord,
  exchangeDeps: null as unknown,
  detailsDeps: null as unknown,
}));

vi.mock("@/card-data/lookup", () => ({
  lookupCard: vi.fn(async () => routeMocks.card),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => {
    const headers = new Headers();
    for (const [key, value] of routeMocks.headerMap.entries()) {
      headers.set(key, value);
    }
    return headers;
  }),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: routeMocks.env })),
}));

vi.mock("@/card-data/server", () => ({
  getCardRepository: vi.fn(async () => routeMocks.repo),
}));

vi.mock("@/exchange/runtime", () => ({
  createProcessExchangeDeps: vi.fn(async () => routeMocks.exchangeDeps),
  createProcessDetailsDeps: vi.fn(async () => routeMocks.detailsDeps),
}));

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

function buildExchangeDeps(
  db: D1Database,
  sinkMessages: unknown[],
  followup: unknown[],
) {
  const ledger = createLeadDeliveryLedgerFromD1(db);
  const now = () => new Date("2026-10-16T12:00:00.000Z");
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
    createLeadId: () => "lead-route-1",
    createLedgerId: () => "ledger-route-1",
    now,
    baseUrl: "https://we-met.link",
    assertLeadEmailCapacity: (cardId: string, needed: number) =>
      assertLeadEmailCapacity(db, cardId, needed, now()),
    readVisitorEmailMode: async () => {
      const controls = await readLeadEmailControls(db);
      return controls.visitorEmailMode;
    },
    incrementDailySendCounts: async () => undefined,
  };
}

describe("exchange and details routes lead_email_unavailable (integration)", () => {
  beforeEach(() => {
    routeMocks.headerMap.clear();
    routeMocks.headerMap.set("host", "we-met.link");
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "production",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
    };
  });

  it("POST /api/exchange returns identical 503 JSON when paused vs over global cap", async () => {
    await withIsolatedLocalD1(async (db) => {
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      routeMocks.repo = repo;
      routeMocks.card = card;
      const sinkMessages: unknown[] = [];
      const followup: unknown[] = [];
      routeMocks.exchangeDeps = buildExchangeDeps(db, sinkMessages, followup);

      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "0",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });

      const paused = await exchangePost(
        new Request("https://we-met.link/api/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: card.slug,
            name: "Visitor",
            email: "visitor@example.com",
            turnstileToken: "tok",
          }),
        }),
      );
      expect(paused.status).toBe(503);
      const pausedBody = await paused.json();

      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "1",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "1",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });
      await db
        .prepare(
          `INSERT INTO daily_send_counts (day, card_id, kind, count) VALUES ('2026-10-16', ?, 'owner', 1)`,
        )
        .bind(card.id)
        .run();

      const capped = await exchangePost(
        new Request("https://we-met.link/api/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: card.slug,
            name: "Visitor",
            email: "visitor@example.com",
            turnstileToken: "tok",
          }),
        }),
      );
      expect(capped.status).toBe(503);
      const cappedBody = await capped.json();
      expect(pausedBody).toEqual(cappedBody);
      expect(pausedBody).toEqual({ error: "lead_email_unavailable" });
      expect(sinkMessages).toHaveLength(0);
      expect(followup).toHaveLength(0);
    });
  });

  it("POST /api/details returns 503 JSON when over global cap", async () => {
    await withIsolatedLocalD1(async (db) => {
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      routeMocks.repo = repo;
      routeMocks.card = card;
      const sinkMessages: unknown[] = [];
      const followup: unknown[] = [];
      const exchangeDeps = buildExchangeDeps(db, sinkMessages, followup);
      routeMocks.detailsDeps = {
        tokenSecret: "secret",
        environment: "preview",
        leadSinkQueue: exchangeDeps.leadSinkQueue,
        deliveryLedger: exchangeDeps.deliveryLedger,
        deliveryLogger: exchangeDeps.deliveryLogger,
        leadSinkLogger: exchangeDeps.leadSinkLogger,
        createLedgerId: () => "ledger-details-route",
        now: exchangeDeps.now,
        baseUrl: "https://we-met.link",
        assertLeadEmailCapacity: exchangeDeps.assertLeadEmailCapacity,
      };

      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "1",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "1",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });
      await db
        .prepare(
          `INSERT INTO daily_send_counts (day, card_id, kind, count) VALUES ('2026-10-16', ?, 'visitor', 1)`,
        )
        .bind(card.id)
        .run();

      const tokenNowSeconds = Math.floor(Date.now() / 1000);
      const token = createDetailsToken(
        "secret",
        {
          leadId: "lead-route-1",
          cardId: card.id,
          cardSlug: card.slug,
          visitorEmail: "visitor@example.com",
          visitorName: "Visitor",
        },
        tokenNowSeconds,
      );

      const response = await detailsPost(
        new Request("https://we-met.link/api/details", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, jobTitle: "CTO" }),
        }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "lead_email_unavailable" });
      expect(sinkMessages).toHaveLength(0);
    });
  });

  it("POST /api/details returns 409 when append ledger already exists for the lead", async () => {
    await withIsolatedLocalD1(async (db) => {
      const repo = new MemoryCardRepository();
      const card = await repo.upsertCard(exampleCardInput());
      routeMocks.repo = repo;
      routeMocks.card = card;
      const sinkMessages: unknown[] = [];
      const followup: unknown[] = [];
      const exchangeDeps = buildExchangeDeps(db, sinkMessages, followup);
      routeMocks.detailsDeps = {
        tokenSecret: "secret",
        environment: "preview",
        leadSinkQueue: exchangeDeps.leadSinkQueue,
        deliveryLedger: exchangeDeps.deliveryLedger,
        deliveryLogger: exchangeDeps.deliveryLogger,
        leadSinkLogger: exchangeDeps.leadSinkLogger,
        createLedgerId: () => "ledger-details-dup",
        now: exchangeDeps.now,
        baseUrl: "https://we-met.link",
        assertLeadEmailCapacity: exchangeDeps.assertLeadEmailCapacity,
      };

      await seedSettings(db, {
        [APP_SETTING_LEAD_EMAIL_ENABLED]: "1",
        [APP_SETTING_DAILY_CAP_GLOBAL]: "500",
        [APP_SETTING_DAILY_CAP_PER_CARD]: "100",
      });

      const leadId = "lead-details-dup";
      await exchangeDeps.deliveryLedger.insertAppendIfAbsent({
        id: "ledger-existing-append",
        leadId,
        cardId: card.id,
        sinkId: "sink-existing",
        sinkKind: "email",
        phase: "append",
        retryUntil: "2026-10-17T12:00:00.000Z",
        createdAt: "2026-10-16T12:00:00.000Z",
      });

      const tokenNowSeconds = Math.floor(Date.now() / 1000);
      const token = createDetailsToken(
        "secret",
        {
          leadId,
          cardId: card.id,
          cardSlug: card.slug,
          visitorEmail: "visitor@example.com",
          visitorName: "Visitor",
        },
        tokenNowSeconds,
      );

      const response = await detailsPost(
        new Request("https://we-met.link/api/details", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, jobTitle: "CTO" }),
        }),
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "details-already-sent" });
      expect(sinkMessages).toHaveLength(0);
    });
  });
});
