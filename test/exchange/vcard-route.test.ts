import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/exchange/vcard/route";
import type { CardRecord } from "@/card-data/types";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { createDetailsToken } from "@/exchange/token";
import { buildOwnerVCardAttachment } from "@/lib/hi/build-owner-vcard";
import { exampleCardInput } from "../helpers/example-card";

const routeMocks = vi.hoisted(() => ({
  headerMap: new Map<string, string>(),
  env: {} as Record<string, unknown>,
  repo: null as unknown as MemoryCardRepository,
  card: null as CardRecord | null,
  vcardDeps: null as unknown,
}));

vi.mock("@/card-data/lookup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/card-data/lookup")>();
  return {
    ...actual,
    lookupCard: vi.fn(async () => routeMocks.card),
  };
});

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
  createProcessVCardDeps: vi.fn(async () => routeMocks.vcardDeps),
}));

function buildCard(overrides: Partial<CardRecord> = {}): CardRecord {
  const input = exampleCardInput();
  return {
    ...input,
    id: "card-vcard-test",
    accountId: "account-vcard-test",
    status: "live",
    updatedAt: "2026-01-01T00:00:00.000Z",
    email: "owner@example.com",
    ...overrides,
  };
}

function validToken(
  secret: string,
  card: CardRecord,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  return createDetailsToken(
    secret,
    {
      leadId: "lead-vcard-1",
      cardId: card.id,
      cardSlug: card.slug,
      visitorEmail: "visitor@example.com",
      visitorName: "Alex Visitor",
    },
    nowSeconds,
  );
}

describe("POST /api/exchange/vcard", () => {
  beforeEach(() => {
    routeMocks.headerMap.clear();
    routeMocks.headerMap.set("host", "we-met.link");
    routeMocks.env.WE_MET_ENV = "production";
    routeMocks.env.WE_MET_BASE_URL = "https://we-met.link";
    const card = buildCard();
    routeMocks.card = card;
    routeMocks.repo = new MemoryCardRepository();
    routeMocks.vcardDeps = {
      tokenSecret: "test-token-secret",
      rateLimiter: { check: async () => ({ allowed: true }) },
      clientIp: "203.0.113.1",
      assets: { get: async () => null },
      now: () => new Date("2026-10-16T12:00:00.000Z"),
    };
  });

  it("returns 405 for GET", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
  });

  it("returns 200 vCard with expected headers and body for a valid JSON token", async () => {
    const card = routeMocks.card!;
    const token = validToken("test-token-secret", card);
    const expected = await buildOwnerVCardAttachment(
      card.contact,
      card.email,
      card.photoKey,
      { get: async () => null },
      { logMissingPhoto: vi.fn(), logNonJpegPhoto: vi.fn() },
    );

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="${expected.filename}"`,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe(expected.vcardBody);
  });

  it("accepts application/x-www-form-urlencoded token body", async () => {
    const card = routeMocks.card!;
    const token = validToken("test-token-secret", card);

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }).toString(),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect((await response.text()).startsWith("BEGIN:VCARD")).toBe(true);
  });

  it("returns 401 invalid_token for expired token without vCard body", async () => {
    const card = routeMocks.card!;
    const token = validToken("test-token-secret", card, 1_000_000);

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toContain("invalid_token");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 401 invalid_token for tampered token", async () => {
    const card = routeMocks.card!;
    const token = `${validToken("test-token-secret", card)}x`;

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  it("returns 401 when token card id does not match published card", async () => {
    const card = routeMocks.card!;
    const token = createDetailsToken("test-token-secret", {
      leadId: "lead-vcard-1",
      cardId: "other-card-id",
      cardSlug: card.slug,
      visitorEmail: "visitor@example.com",
      visitorName: "Alex Visitor",
    });

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  it("returns 404 when card is not found", async () => {
    routeMocks.card = null;
    const card = buildCard();
    const token = validToken("test-token-secret", card);

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "card_not_found" });
  });

  it("returns 429 when rate limited", async () => {
    const baseDeps = routeMocks.vcardDeps as {
      tokenSecret: string;
      rateLimiter: { check: () => Promise<{ allowed: boolean }> };
      clientIp: string;
      assets: { get: () => Promise<null> };
      now: () => Date;
    };
    routeMocks.vcardDeps = {
      ...baseDeps,
      rateLimiter: { check: async () => ({ allowed: false }) },
    };
    const card = routeMocks.card!;
    const token = validToken("test-token-secret", card);

    const response = await POST(
      new Request("https://we-met.link/api/exchange/vcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
  });
});
