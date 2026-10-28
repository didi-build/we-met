import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/exchange/route";
import type { CardRecord } from "@/card-data/types";

const routeMocks = vi.hoisted(() => ({
  writeDataPoint: vi.fn(),
  headerMap: new Map<string, string>(),
  env: {} as Record<string, unknown>,
  card: null as CardRecord | null,
  processResult: null as unknown,
  getCardRepository: vi.fn(),
  createProcessExchangeDeps: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "production",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      WE_MET_EXCHANGE_OUTCOME_ANALYTICS: {
        writeDataPoint: routeMocks.writeDataPoint,
      },
      ...routeMocks.env,
    },
  })),
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

vi.mock("@/card-data/lookup", () => ({
  lookupCard: vi.fn(async () => routeMocks.card),
}));

vi.mock("@/card-data/server", () => ({
  getCardRepository: routeMocks.getCardRepository,
}));

vi.mock("@/exchange/runtime", () => ({
  createProcessExchangeDeps: routeMocks.createProcessExchangeDeps,
}));

vi.mock("@/exchange/process-exchange", () => ({
  processExchange: vi.fn(async () => routeMocks.processResult),
}));

function expectSingleOutcome(className: string) {
  expect(routeMocks.writeDataPoint).toHaveBeenCalledTimes(1);
  expect(routeMocks.writeDataPoint).toHaveBeenCalledWith({
    indexes: ["exchange_outcome"],
    blobs: [className],
    doubles: [1],
  });
}

function validExchangeBody(overrides: Record<string, string> = {}) {
  return JSON.stringify({
    slug: "demo",
    name: "Visitor",
    email: "visitor@example.com",
    turnstileToken: "tok",
    ...overrides,
  });
}

describe("POST /api/exchange analytics (integration)", () => {
  beforeEach(() => {
    routeMocks.writeDataPoint.mockReset();
    routeMocks.headerMap.clear();
    routeMocks.headerMap.set("host", "we-met.link");
    routeMocks.env = {};
    routeMocks.card = { id: "card-1", slug: "demo" } as CardRecord;
    routeMocks.getCardRepository.mockResolvedValue({
      listLeadSinks: async () => [],
    });
    routeMocks.createProcessExchangeDeps.mockResolvedValue({});
    routeMocks.processResult = {
      status: "success",
      body: { token: "t", ownerEmail: "o@example.com" },
    };
  });

  it("records 4xx for invalid JSON", async () => {
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    expectSingleOutcome("4xx");
  });

  it("records 4xx for validation errors", async () => {
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "" }),
      }),
    );
    expect(response.status).toBe(400);
    expectSingleOutcome("4xx");
  });

  it("does not record honeypot fake 200 outcomes", async () => {
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody({ website: "https://spam.example" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(routeMocks.writeDataPoint).not.toHaveBeenCalled();
  });

  it("records 4xx for non-card-serving host 404", async () => {
    routeMocks.headerMap.set("host", "app.we-met.link");
    const response = await POST(
      new Request("https://app.we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(404);
    expectSingleOutcome("4xx");
  });

  it("records 2xx on success", async () => {
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(200);
    expectSingleOutcome("2xx");
  });

  it("records 429 when rate limited", async () => {
    routeMocks.processResult = { status: "rate_limited" };
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(429);
    expectSingleOutcome("429");
  });

  it("records 5xx when enqueue fails", async () => {
    routeMocks.processResult = { status: "enqueue_failed" };
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(500);
    expectSingleOutcome("5xx");
  });

  it("records kill-switch 503 when lead email kill switch is on", async () => {
    routeMocks.processResult = {
      status: "lead_email_unavailable",
      reason: "kill_switch",
    };
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "lead_email_unavailable" });
    expectSingleOutcome("kill-switch 503");
  });

  it("records cap_reached when daily cap blocks the exchange", async () => {
    routeMocks.processResult = {
      status: "lead_email_unavailable",
      reason: "cap_reached",
    };
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(503);
    expectSingleOutcome("cap_reached");
  });

  it("records cap_config_error when cap settings are invalid", async () => {
    routeMocks.processResult = {
      status: "lead_email_unavailable",
      reason: "cap_config_error",
    };
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(503);
    expectSingleOutcome("cap_config_error");
  });

  it("records 5xx when processing throws", async () => {
    routeMocks.getCardRepository.mockRejectedValue(new Error("d1 down"));
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: validExchangeBody(),
      }),
    );
    expect(response.status).toBe(500);
    expectSingleOutcome("5xx");
  });

  it("still returns the exchange response when Analytics Engine write throws", async () => {
    routeMocks.writeDataPoint.mockImplementation(() => {
      throw new Error("analytics down");
    });
    const response = await POST(
      new Request("https://we-met.link/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.writeDataPoint).toHaveBeenCalledTimes(1);
  });
});
