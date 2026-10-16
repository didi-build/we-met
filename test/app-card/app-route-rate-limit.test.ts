import { describe, expect, it, vi } from "vitest";
import { GET as cardGet } from "@/app/api/app/card/route";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
  limitCalls: 0,
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

describe("app card route auth order (integration)", () => {
  it("applies IP auth rate limiting before session lookup", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.limitCalls = 0;
      routeMocks.env = {
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "preview",
        WE_MET_APP_ORIGIN: "https://app.we-met.link",
        WE_MET_PREVIEW_HOST_SUFFIX: "-we-met.example.workers.dev",
        WE_MET_DB: db,
        WE_MET_AUTH_RATE_LIMITER: {
          limit: async () => {
            routeMocks.limitCalls += 1;
            return { success: false };
          },
        },
      };
      routeMocks.headerMap.set("host", "pr-1-we-met.example.workers.dev");
      routeMocks.headerMap.set("x-forwarded-for", "198.51.100.9");

      const response = await cardGet();
      expect(response.status).toBe(429);
      expect(routeMocks.limitCalls).toBe(1);
      expect(routeMocks.headerMap.get("cookie")).toBeUndefined();
    });
  });
});
