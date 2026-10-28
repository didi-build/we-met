import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/exchange/route";

const routeMocks = vi.hoisted(() => ({
  writeDataPoint: vi.fn(),
  env: {} as Record<string, unknown>,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: {
      WE_MET_EXCHANGE_OUTCOME_ANALYTICS: {
        writeDataPoint: routeMocks.writeDataPoint,
      },
      ...routeMocks.env,
    },
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

describe("POST /api/exchange analytics (integration)", () => {
  beforeEach(() => {
    routeMocks.writeDataPoint.mockClear();
  });

  it("records 4xx for invalid JSON without failing the response", async () => {
    const response = await POST(
      new Request("http://localhost/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.writeDataPoint).toHaveBeenCalledWith({
      indexes: ["exchange_outcome"],
      blobs: ["4xx"],
      doubles: [1],
    });
  });

  it("does not record honeypot fake 200 outcomes", async () => {
    const response = await POST(
      new Request("http://localhost/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "demo",
          name: "Bot",
          email: "bot@example.com",
          turnstileToken: "token",
          website: "https://spam.example",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(routeMocks.writeDataPoint).not.toHaveBeenCalled();
  });

  it("still returns the exchange response when Analytics Engine write throws", async () => {
    routeMocks.writeDataPoint.mockImplementation(() => {
      throw new Error("analytics down");
    });
    const response = await POST(
      new Request("http://localhost/api/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
    expect(routeMocks.writeDataPoint).toHaveBeenCalled();
  });
});
