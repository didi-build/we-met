import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUT as draftPut } from "@/app/api/app/card/draft/route";
import { POST as publishPost } from "@/app/api/app/card/publish/route";
import { GET as slugCheckGet } from "@/app/api/app/slug-check/route";
import { POST as previewLoginPost } from "@/app/api/auth/preview-login/route";
import { SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { createCardRepositoryFromD1 } from "@/card-data/get-repository";
import { resolveLeadSinksForDispatch } from "@/card-data/account-email";
import { createLeadDeliveryLedgerFromD1 } from "@/lead-delivery-ledger/d1-repository";
import { processExchange } from "@/exchange/process-exchange";
import type { ProcessExchangeDeps } from "@/exchange/process-exchange";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: routeMocks.env })),
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

vi.mock("@/images/ingest-card-photo", () => ({
  ingestCardPhotoFromRequest: vi.fn(async () => ({
    ok: true,
    key: "c".repeat(64),
    size: 10,
  })),
}));

function mutationHeaders(): HeadersInit {
  return {
    origin: "https://pr-37-we-met.example.workers.dev",
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
  };
}

describe("card editor full flow (integration)", () => {
  beforeEach(() => {
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "preview",
      WE_MET_APP_ORIGIN: "https://app.we-met.link",
      WE_MET_PREVIEW_HOST_SUFFIX: "-we-met.example.workers.dev",
      WE_MET_PREVIEW_LOGIN_SECRET: "test-preview-secret",
      WE_MET_PREVIEW_LOGIN_EMAIL: "owner@example.com",
      WE_MET_AUTH_RATE_LIMITER: {
        limit: async () => ({ success: true }),
      },
      WE_MET_ASSETS: {
        head: vi.fn(async () => ({
          httpMetadata: { contentType: "image/jpeg" },
        })),
      },
      IMAGES: {},
    };
    routeMocks.headerMap.set("host", "pr-37-we-met.example.workers.dev");
  });

  it("preview login → save → slug-check → publish → exchange ledger row", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const login = await previewLoginPost(
        new Request("https://pr-37-we-met.example.workers.dev/api/auth/preview-login", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ secret: "test-preview-secret" }),
        }),
      );
      expect(login.status).toBe(200);
      const cookie = login.headers.get("set-cookie") ?? "";
      const token = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
      expect(token).toBeTruthy();
      routeMocks.headerMap.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);

      const card = {
        slug: "flow-card",
        name: "Owner",
        role: "Builder",
        photo: "",
        about: ["Hello"],
        services: [],
        links: {
          website: "https://example.com",
          linkedin: "",
          github: "",
          instagram: "",
        },
        alternate: { url: "", label: "" },
      };

      const draftRes = await draftPut(
        new Request("https://pr-37-we-met.example.workers.dev/api/app/card/draft", {
          method: "PUT",
          headers: mutationHeaders(),
          body: JSON.stringify({ card }),
        }),
      );
      expect(draftRes.status).toBe(200);

      const slugRes = await slugCheckGet(
        new Request(
          "https://pr-37-we-met.example.workers.dev/api/app/slug-check?slug=flow-card",
        ),
      );
      expect(slugRes.status).toBe(200);

      const publishRes = await publishPost(
        new Request("https://pr-37-we-met.example.workers.dev/api/app/card/publish", {
          method: "POST",
          headers: mutationHeaders(),
          body: JSON.stringify({ card }),
        }),
      );
      expect(publishRes.status).toBe(200);
      const published = (await publishRes.json()) as { url: string };
      expect(published.url).toContain("/hi/flow-card");

      const repo = createCardRepositoryFromD1(db);
      const record = await repo.getBySlug("flow-card");
      expect(record?.slug).toBe("flow-card");

      const sinks = await repo.listLeadSinks(record!.id);
      const resolved = resolveLeadSinksForDispatch(sinks, "owner@example.com");
      expect((resolved[0]?.config as { to: string }).to).toBe("owner@example.com");

      const ledger = createLeadDeliveryLedgerFromD1(db);
      const deps: ProcessExchangeDeps = {
        turnstile: { verify: async () => ({ success: true }) },
        rateLimiter: { check: async () => ({ allowed: true }) },
        followupQueue: { enqueueVisitorFollowup: async () => undefined },
        leadSinkQueue: { enqueueLeadSink: async () => undefined },
        deliveryLedger: ledger,
        deliveryLogger: {
          logLedgerWriteFailed: vi.fn(),
          logLedgerEnqueueFailed: vi.fn(),
        },
        tokenSecret: "secret",
        environment: "preview",
        clientIp: "203.0.113.2",
        leadSinkLogger: { logSinkEnqueueFailure: vi.fn() },
        createLeadId: () => "lead-flow-1",
        createLedgerId: () => "ledger-flow-1",
        now: () => new Date("2026-10-12T12:00:00.000Z"),
        baseUrl: "https://we-met.link",
        assertLeadEmailCapacity: async () => true,
        readVisitorEmailMode: async () => "owner_relay",
        incrementDailySendCounts: async () => undefined,
      };

      const exchange = await processExchange(
        {
          slug: "flow-card",
          name: "Visitor",
          email: "visitor@example.com",
          phone: null,
          turnstileToken: "tok",
        },
        record!,
        sinks,
        deps,
      );
      expect(exchange.status).toBe("success");

      const row = await db
        .prepare(
          "SELECT sink_id, status FROM lead_delivery_ledger WHERE lead_id = 'lead-flow-1'",
        )
        .first<{ sink_id: string; status: string }>();
      expect(row?.sink_id).toBe(`${record!.slug}-owner-inbox`);
      expect(row?.status).toBe("queued");
    });
  });
});
