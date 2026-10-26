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

function headerSnapshot(response: Response): string {
  return [...response.headers.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

async function expectUniform404(
  response: Response,
  baselineHeaders: string | null,
): Promise<string> {
  expect(response.status).toBe(404);
  expect(await response.text()).toBe("");
  const headers = headerSnapshot(response);
  if (baselineHeaders !== null) {
    expect(headers).toBe(baselineHeaders);
  }
  return headers;
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
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe(expected.vcardBody);
  });

  it("returns 404 for missing, tampered, or wrong-exchange tokens", async () => {
    const card = await routeMocks.repo.getBySlug("relay-card");
    const token = createExchangeContactCardToken("test-token-secret", {
      leadId: "lead-a",
      cardId: card!.id,
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

  it("still serves the card after the owner renames their slug", async () => {
    const card = await routeMocks.repo.getBySlug("relay-card");
    expect(card).toBeTruthy();
    const token = createExchangeContactCardToken("test-token-secret", {
      leadId: "lead-after-rename",
      cardId: card!.id,
    });
    routeMocks.repo.renameSlugForTest(card!.id, "relay-card-renamed");
    expect(await routeMocks.repo.getBySlug("relay-card")).toBeNull();
    expect(await routeMocks.repo.getBySlug("relay-card-renamed")).toBeTruthy();

    const renamed = await routeMocks.repo.getBySlug("relay-card-renamed");
    const expected = await buildOwnerVCardAttachment(
      renamed!.contact,
      renamed!.email,
      renamed!.photoKey,
      { get: async () => null },
      { logMissingPhoto: () => undefined, logNonJpegPhoto: () => undefined },
    );

    const response = await getContactCard("lead-after-rename", token);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(expected.vcardBody);
  });

  it("returns uniform 404 for deleted, unpublished, missing sink, wrong card, and rate limit", async () => {
    const card = await routeMocks.repo.getBySlug("relay-card");
    expect(card).toBeTruthy();
    const leadId = "lead-uniform-404";
    const goodToken = createExchangeContactCardToken("test-token-secret", {
      leadId,
      cardId: card!.id,
    });

    routeMocks.repo.setCardStatusForTest(card!.id, "retired");
    const baseline = await expectUniform404(
      await getContactCard(leadId, goodToken),
      null,
    );

    await upsertCardWithEmailSink(routeMocks.repo, {
      ...exampleCardInput(),
      slug: "relay-card-live-again",
    });
    const liveCard = await routeMocks.repo.getBySlug("relay-card-live-again");
    expect(liveCard).toBeTruthy();
    const liveToken = createExchangeContactCardToken("test-token-secret", {
      leadId,
      cardId: liveCard!.id,
    });
    routeMocks.repo.setCardStatusForTest(liveCard!.id, "suspended");
    await expectUniform404(await getContactCard(leadId, liveToken), baseline);

    const noSinkRepo = new MemoryCardRepository();
    const noSinkCard = await noSinkRepo.upsertCard({
      ...exampleCardInput(),
      slug: "no-sink-card",
    });
    routeMocks.repo = noSinkRepo;
    const noSinkToken = createExchangeContactCardToken("test-token-secret", {
      leadId,
      cardId: noSinkCard.id,
    });
    await expectUniform404(await getContactCard(leadId, noSinkToken), baseline);

    routeMocks.repo = new MemoryCardRepository();
    await upsertCardWithEmailSink(routeMocks.repo, {
      ...exampleCardInput(),
      slug: "other-card",
    });
    const wrongCardToken = createExchangeContactCardToken("test-token-secret", {
      leadId,
      cardId: "00000000-0000-4000-8000-000000000099",
    });
    await expectUniform404(await getContactCard(leadId, wrongCardToken), baseline);

    routeMocks.repo = new MemoryCardRepository();
    await upsertCardWithEmailSink(routeMocks.repo, {
      ...exampleCardInput(),
      slug: "rate-limit-card",
    });
    const rateCard = await routeMocks.repo.getBySlug("rate-limit-card");
    const rateToken = createExchangeContactCardToken("test-token-secret", {
      leadId,
      cardId: rateCard!.id,
    });
    routeMocks.deps = defaultDeps({
      rateLimiter: { check: async () => ({ allowed: false }) },
    });
    await expectUniform404(await getContactCard(leadId, rateToken), baseline);
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
