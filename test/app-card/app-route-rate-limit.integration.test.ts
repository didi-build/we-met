import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cardGet } from "@/app/api/app/card/route";
import { PUT as draftPut } from "@/app/api/app/card/draft/route";
import { SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { createSession } from "@/app-auth/sessions";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
  authLimitCalls: 0,
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

function mutationHeaders(origin: string): HeadersInit {
  return {
    origin,
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
  };
}

describe("app card route rate limits (integration)", () => {
  beforeEach(() => {
    routeMocks.authLimitCalls = 0;
  });

  it("applies IP auth rate limiting only for unauthenticated requests", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env = {
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "preview",
        WE_MET_APP_ORIGIN: "https://app.we-met.link",
        WE_MET_PREVIEW_HOST_SUFFIX: "-we-met-preview.example.workers.dev",
        WE_MET_DB: db,
        WE_MET_AUTH_RATE_LIMITER: {
          limit: async () => {
            routeMocks.authLimitCalls += 1;
            return { success: false };
          },
        },
      };
      const previewHost = "pr-1-we-met-preview.example.workers.dev";
      routeMocks.headerMap.set("host", previewHost);
      routeMocks.headerMap.set("x-forwarded-for", "198.51.100.9");

      const response = await cardGet();
      expect(response.status).toBe(429);
      expect(routeMocks.authLimitCalls).toBe(1);
    });
  });

  it("returns 401 without IP limiting when the auth limiter allows the request", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env = {
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "preview",
        WE_MET_APP_ORIGIN: "https://app.we-met.link",
        WE_MET_PREVIEW_HOST_SUFFIX: "-we-met-preview.example.workers.dev",
        WE_MET_DB: db,
        WE_MET_AUTH_RATE_LIMITER: {
          limit: async () => {
            routeMocks.authLimitCalls += 1;
            return { success: true };
          },
        },
      };
      const previewHost = "pr-2-we-met-preview.example.workers.dev";
      routeMocks.headerMap.set("host", previewHost);
      routeMocks.headerMap.set("x-forwarded-for", "198.51.100.10");

      const response = await cardGet();
      expect(response.status).toBe(401);
      expect(routeMocks.authLimitCalls).toBe(1);
    });
  });

  it("does not apply IP auth rate limiting to 15 authenticated draft saves in one minute", async () => {
    await withIsolatedLocalD1(async (db) => {
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO accounts (id, google_sub, email, name, status, created_at, updated_at)
           VALUES ('a1', 'sub-a1', 'owner@example.com', 'Owner', 'active', ?, ?)`,
        )
        .bind(now, now)
        .run();
      const session = await createSession(db, "a1");
      const previewHost = "pr-3-we-met-preview.example.workers.dev";
      routeMocks.env = {
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "preview",
        WE_MET_APP_ORIGIN: "https://app.we-met.link",
        WE_MET_PREVIEW_HOST_SUFFIX: "-we-met-preview.example.workers.dev",
        WE_MET_DB: db,
        WE_MET_AUTH_RATE_LIMITER: {
          limit: async () => {
            routeMocks.authLimitCalls += 1;
            return { success: false };
          },
        },
      };
      routeMocks.headerMap.set("host", previewHost);
      routeMocks.headerMap.set("x-forwarded-for", "198.51.100.11");
      routeMocks.headerMap.set("cookie", `${SESSION_COOKIE_NAME}=${session.token}`);

      const card = {
        slug: "",
        name: "Owner",
        role: "",
        photo: "",
        about: [],
        services: [],
        links: { website: "", linkedin: "", github: "", instagram: "" },
        alternate: { url: "", label: "" },
      };

      for (let i = 0; i < 15; i++) {
        const response = await draftPut(
          new Request(`https://${previewHost}/api/app/card/draft`, {
            method: "PUT",
            headers: mutationHeaders(`https://${previewHost}`),
            body: JSON.stringify({ card: { ...card, name: `Owner ${i}` } }),
          }),
        );
        expect(response.status).toBe(200);
      }
      expect(routeMocks.authLimitCalls).toBe(0);
    });
  });
});
