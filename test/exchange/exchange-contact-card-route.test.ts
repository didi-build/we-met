import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/exchange/[leadId]/contact-card/route";
import { ACCOUNT_EMAIL_SENTINEL } from "@/card-data/account-email";
import { MemoryCardRepository } from "@/card-data/memory-repository";
import { createExchangeContactCardToken } from "@/exchange/exchange-contact-card-token";
import { createDetailsToken } from "@/exchange/token";
import { buildOwnerVCardAttachment } from "@/lib/hi/build-owner-vcard";
import { upsertCardWithEmailSink } from "../helpers/card-email-sink";
import { exampleCardInput } from "../helpers/example-card";

const routeMocks = vi.hoisted(() => ({
  headerMap: new Map<string, string>(),
  env: {} as Record<string, unknown>,
  repo: null as unknown as MemoryCardRepository,
  deps: null as unknown,
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
  createProcessExchangeContactCardDeps: vi.fn(async () => routeMocks.deps),
}));

function defaultDeps(overrides: Record<string, unknown> = {}) {
  return {
    tokenSecret: "test-token-secret",
    rateLimiter: { check: async () => ({ allowed: true }) },
    clientIp: "203.0.113.1",
    assets: { get: async () => null },
    logDownload: vi.fn(),
    ...overrides,
  };
}

async function getContactCard(leadId: string, token?: string): Promise<Response> {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const request = new Request(
    `https://we-met.link/api/exchange/${encodeURIComponent(leadId)}/contact-card${query}`,
  );
  return GET(request, { params: Promise.resolve({ leadId }) });
}

function listRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      listRouteFiles(path, out);
    } else if (entry === "route.ts") {
      out.push(path);
    }
  }
  return out;
}

describe("GET /api/exchange/[leadId]/contact-card", () => {
  beforeEach(async () => {
    routeMocks.headerMap.clear();
    routeMocks.headerMap.set("host", "we-met.link");
    routeMocks.env.WE_MET_ENV = "production";
    routeMocks.env.WE_MET_BASE_URL = "https://we-met.link";
    const repo = new MemoryCardRepository();
    await upsertCardWithEmailSink(repo, { ...exampleCardInput(), slug: "relay-card" });
    routeMocks.repo = repo;
    routeMocks.deps = defaultDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 text/vcard for a valid exchange-bound token", async () => {
    const card = await routeMocks.repo.getBySlug("relay-card");
    expect(card).toBeTruthy();
    const token = createExchangeContactCardToken("test-token-secret", {
      leadId: "lead-relay-1",
      cardId: card!.id,
      cardSlug: card!.slug,
    });
    const expected = await buildOwnerVCardAttachment(
      card!.contact,
      card!.email,
      card!.photoKey,
      { get: async () => null },
      { logMissingPhoto: () => undefined, logNonJpegPhoto: () => undefined },
    );

    const response = await getContactCard("lead-relay-1", token);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect(await response.text()).toBe(expected.vcardBody);
  });

  it("returns 404 for missing, tampered, or wrong-exchange tokens", async () => {
    const card = await routeMocks.repo.getBySlug("relay-card");
    const token = createExchangeContactCardToken("test-token-secret", {
      leadId: "lead-a",
      cardId: card!.id,
      cardSlug: card!.slug,
    });

    expect((await getContactCard("lead-a")).status).toBe(404);
    expect((await getContactCard("lead-a", `${token}x`)).status).toBe(404);
    expect((await getContactCard("lead-b", token)).status).toBe(404);

    const detailsToken = createDetailsToken("test-token-secret", {
      leadId: "lead-a",
      cardId: card!.id,
      cardSlug: card!.slug,
      visitorEmail: "visitor@example.com",
      visitorName: "Alex",
    });
    expect((await getContactCard("lead-a", detailsToken)).status).toBe(404);
  });

  it("returns 404 when the card is suspended", async () => {
    const repo = new MemoryCardRepository();
    const suspended = await repo.upsertCard({
      ...exampleCardInput(),
      slug: "suspended-relay-card",
      status: "suspended",
    });
    await repo.addLeadSink(suspended.id, {
      kind: "email",
      config: { to: ACCOUNT_EMAIL_SENTINEL },
      enabled: true,
    });
    routeMocks.repo = repo;
    const token = createExchangeContactCardToken("test-token-secret", {
      leadId: "lead-suspended",
      cardId: suspended.id,
      cardSlug: suspended.slug,
    });
    const response = await getContactCard("lead-suspended", token);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("logs download with exchange id only", async () => {
    const card = await routeMocks.repo.getBySlug("relay-card");
    const logDownload = vi.fn();
    routeMocks.deps = defaultDeps({ logDownload });
    const token = createExchangeContactCardToken("test-token-secret", {
      leadId: "lead-log-1",
      cardId: card!.id,
      cardSlug: card!.slug,
    });
    await getContactCard("lead-log-1", token);
    expect(logDownload).toHaveBeenCalledWith("lead-log-1");
    expect(logDownload.mock.calls[0]?.[0]).not.toMatch(/@/);
  });
});

describe("DIDI-641 vCard route regression (unit)", () => {
  it("only exposes token-gated vCard download handlers under src/app", () => {
    const appRoot = join(process.cwd(), "src/app");
    const routes = listRouteFiles(appRoot);
    const vcardRoutes = routes.filter((path) => {
      const normalized = path.replace(/\\/g, "/");
      return (
        normalized.includes("/exchange/") &&
        (normalized.includes("vcard") || normalized.includes("contact-card"))
      );
    });
    expect(vcardRoutes.sort()).toEqual(
      [
        join(appRoot, "api/exchange/vcard/route.ts"),
        join(appRoot, "api/exchange/[leadId]/contact-card/route.ts"),
      ].sort(),
    );
    expect(routes.some((p) => p.includes("contact.vcf"))).toBe(false);
  });
});
