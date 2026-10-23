import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/exchange/vcard/route";
import {
  APP_SETTING_DAILY_CAP_GLOBAL,
  APP_SETTING_DAILY_CAP_PER_CARD,
  APP_SETTING_LEAD_EMAIL_ENABLED,
} from "@/app-settings/defaults";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import * as lookupModule from "@/card-data/lookup";
import type { CardContact, CardRecord } from "@/card-data/types";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { createDetailsToken } from "@/exchange/token";
import { buildOwnerVCardAttachment } from "@/lib/hi/build-owner-vcard";
import { upsertCardWithEmailSink } from "../helpers/card-email-sink";
import { exampleCardInput } from "../helpers/example-card";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  headerMap: new Map<string, string>(),
  env: {} as Record<string, unknown>,
  repo: null as unknown as MemoryCardRepository,
  vcardDeps: null as unknown,
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
  createProcessVCardDeps: vi.fn(async () => routeMocks.vcardDeps),
}));

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

async function seedLiveCard(
  repo: MemoryCardRepository,
  slug = "vcard-test",
): Promise<CardRecord> {
  return upsertCardWithEmailSink(repo, { ...exampleCardInput(), slug });
}

function defaultVcardDeps(overrides: Record<string, unknown> = {}) {
  return {
    tokenSecret: "test-token-secret",
    rateLimiter: { check: async () => ({ allowed: true }) },
    clientIp: "203.0.113.1",
    assets: { get: async () => null },
    now: () => new Date("2026-10-16T12:00:00.000Z"),
    ...overrides,
  };
}

async function postVcard(
  init: RequestInit & { queryToken?: string } = {},
): Promise<Response> {
  const { queryToken, ...requestInit } = init;
  const url = queryToken
    ? `https://we-met.link/api/exchange/vcard?token=${encodeURIComponent(queryToken)}`
    : "https://we-met.link/api/exchange/vcard";
  return POST(new Request(url, { method: "POST", ...requestInit }));
}

describe("POST /api/exchange/vcard", () => {
  let card: CardRecord;

  beforeEach(async () => {
    routeMocks.headerMap.clear();
    routeMocks.headerMap.set("host", "we-met.link");
    routeMocks.env.WE_MET_ENV = "production";
    routeMocks.env.WE_MET_BASE_URL = "https://we-met.link";
    const repo = new MemoryCardRepository();
    card = await seedLiveCard(repo);
    routeMocks.repo = repo;
    routeMocks.vcardDeps = defaultVcardDeps();
  });

  it("returns 405 for GET with Allow: POST", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("returns 200 vCard with expected headers and body for a valid JSON token", async () => {
    const token = validToken("test-token-secret", card);
    const expected = await buildOwnerVCardAttachment(
      card.contact,
      card.email,
      card.photoKey,
      { get: async () => null },
      { logMissingPhoto: vi.fn(), logNonJpegPhoto: vi.fn() },
    );

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="${expected.filename}"`,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe(expected.vcardBody);
  });

  it("accepts application/x-www-form-urlencoded token body", async () => {
    const token = validToken("test-token-secret", card);

    const response = await postVcard({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect((await response.text()).startsWith("BEGIN:VCARD")).toBe(true);
  });

  it("returns 400 invalid_input for missing token", async () => {
    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("invalid_input");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 303 to / for missing form token without a safe slug", async () => {
    const response = await postVcard({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ slug: "https://evil.test" }).toString(),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
  });

  it("returns 303 with expired for form invalid_token using slug from token", async () => {
    const token = validToken("test-token-secret", card, 1_000_000);
    const response = await postVcard({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, slug: card.slug }).toString(),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(`/hi/${card.slug}?vcard=expired`);
    expect(await response.text()).toBe("");
  });

  it("returns 303 with limited for form rate_limited", async () => {
    routeMocks.vcardDeps = defaultVcardDeps({
      rateLimiter: { check: async () => ({ allowed: false }) },
    });
    const token = validToken("test-token-secret", card);
    const response = await postVcard({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, slug: card.slug }).toString(),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(`/hi/${card.slug}?vcard=limited`);
  });

  it("returns 303 with expired for form card_not_found", async () => {
    const repo = new MemoryCardRepository();
    const suspended = await repo.upsertCard({
      ...exampleCardInput(),
      slug: "suspended-form",
      status: "suspended",
    });
    routeMocks.repo = repo;
    const token = validToken("test-token-secret", suspended);
    const response = await postVcard({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/hi/suspended-form?vcard=expired");
  });

  it("returns 303 with limited for form server_error", async () => {
    routeMocks.vcardDeps = defaultVcardDeps({
      assets: {
        get: async () => {
          throw new Error("r2 down");
        },
      },
    });
    const token = validToken("test-token-secret", card);
    const response = await postVcard({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(`/hi/${card.slug}?vcard=limited`);
  });

  it("keeps JSON errors for the same failure modes", async () => {
    const expiredToken = validToken("test-token-secret", card, 1_000_000);
    const jsonExpired = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: expiredToken }),
    });
    expect(jsonExpired.status).toBe(401);
    expect(await jsonExpired.json()).toEqual({ error: "invalid_token" });

    routeMocks.vcardDeps = defaultVcardDeps({
      rateLimiter: { check: async () => ({ allowed: false }) },
    });
    const token = validToken("test-token-secret", card);
    const jsonLimited = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(jsonLimited.status).toBe(429);
    expect(await jsonLimited.json()).toEqual({ error: "rate_limited" });
  });

  it("redirects to / when form slug is an open-redirect pattern", async () => {
    const token = validToken("test-token-secret", card, 1_000_000);
    const cases = [
      { slug: "https://evil.test" },
      { slug: "//evil.test" },
      { slug: "%2Fevil" },
      { slug: "not-a-valid-slug!" },
    ];
    for (const { slug } of cases) {
      const response = await postVcard({
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token, slug }).toString(),
      });
      expect(response.status).toBe(303);
      expect(response.headers.get("Location")).toBe("/");
    }
  });

  it("returns 400 invalid_input for unsupported Content-Type", async () => {
    const token = validToken("test-token-secret", card);
    const response = await postVcard({
      headers: { "Content-Type": "text/plain" },
      body: token,
    });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("invalid_input");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 400 when token is only in the query string", async () => {
    const token = validToken("test-token-secret", card);
    const response = await postVcard({
      queryToken: token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("invalid_input");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 401 invalid_token on a non-card-serving host", async () => {
    routeMocks.headerMap.set("host", "app.we-met.link");
    const token = validToken("test-token-secret", card);
    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  it("returns 401 invalid_token for expired token without vCard body", async () => {
    const token = validToken("test-token-secret", card, 1_000_000);

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toContain("invalid_token");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 401 invalid_token for tampered token", async () => {
    const token = `${validToken("test-token-secret", card)}x`;

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  it("returns 401 when token card id does not match published card", async () => {
    const token = createDetailsToken("test-token-secret", {
      leadId: "lead-vcard-1",
      cardId: "other-card-id",
      cardSlug: card.slug,
      visitorEmail: "visitor@example.com",
      visitorName: "Alex Visitor",
    });

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  it("returns 404 via lookupCard when the card is suspended", async () => {
    const repo = new MemoryCardRepository();
    const suspended = await repo.upsertCard({
      ...exampleCardInput(),
      slug: "suspended-vcard",
      status: "suspended",
    });
    await repo.addLeadSink(suspended.id, {
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
      enabled: true,
    });
    routeMocks.repo = repo;
    const token = validToken("test-token-secret", suspended);

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toContain("card_not_found");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 404 via lookupCard when the card has no enabled email sink", async () => {
    const repo = new MemoryCardRepository();
    const noSink = await repo.upsertCard({
      ...exampleCardInput(),
      slug: "no-sink-vcard",
    });
    routeMocks.repo = repo;
    const token = validToken("test-token-secret", noSink);

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toContain("card_not_found");
    expect(body).not.toContain("BEGIN:VCARD");
  });

  it("returns 200 when lead_email_enabled is off", async () => {
    await withIsolatedLocalD1(async (db) => {
      await db
        .prepare(
          `INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .bind(APP_SETTING_LEAD_EMAIL_ENABLED, "0")
        .run();
      await db
        .prepare(
          `INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .bind(APP_SETTING_DAILY_CAP_GLOBAL, "500")
        .run();
      await db
        .prepare(
          `INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .bind(APP_SETTING_DAILY_CAP_PER_CARD, "100")
        .run();

      const repo = new MemoryCardRepository();
      const live = await seedLiveCard(repo, "lead-off-vcard");
      routeMocks.repo = repo;
      const token = validToken("test-token-secret", live);

      const response = await postVcard({
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      expect(response.status).toBe(200);
      expect((await response.text()).startsWith("BEGIN:VCARD")).toBe(true);
    });
  });

  it("returns 429 without calling lookupCard or assets.get when rate limited", async () => {
    const lookupSpy = vi.spyOn(lookupModule, "lookupCard");
    const assetsGet = vi.fn(async () => null);
    const rateCheck = vi.fn(async () => ({ allowed: false }));
    routeMocks.vcardDeps = defaultVcardDeps({
      rateLimiter: { check: rateCheck },
      assets: { get: assetsGet },
    });
    const token = validToken("test-token-secret", card);

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(rateCheck).toHaveBeenCalledWith("vcard:203.0.113.1");
    expect(lookupSpy).not.toHaveBeenCalled();
    expect(assetsGet).not.toHaveBeenCalled();
    lookupSpy.mockRestore();
  });

  it("escapes contact fields and sanitizes Content-Disposition filename", async () => {
    const trickyContact: CardContact = {
      name: {
        full: 'Doe";comma,semicolon\nnewline',
        family: 'Fam";',
        given: "Given,",
        nickname: "",
      },
      org: 'Org";semicolon\n',
      title: "Title",
      phone: "",
      vcardNote: "Note",
      urls: [],
    };
    const repo = new MemoryCardRepository();
    const escapedCard = await upsertCardWithEmailSink(repo, {
      ...exampleCardInput(),
      slug: "vcard-escape",
      contact: trickyContact,
    });
    routeMocks.repo = repo;
    const token = validToken("test-token-secret", escapedCard);

    const response = await postVcard({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(200);
    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toBe('attachment; filename="Doe-comma-semicolon-newline.vcf"');
    const vcard = await response.text();
    expect(vcard).toContain('N:Fam"\\;;Given\\,;;;');
    expect(vcard).toContain('FN:Doe"\\;comma\\,semicolon\\nnewline');
    expect(vcard).toContain('ORG:Org"\\;semicolon\\n');
  });
});
