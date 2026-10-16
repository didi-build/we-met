import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as sessionGet } from "@/app/api/app/session/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as previewLoginPost } from "@/app/api/auth/preview-login/route";
import { GET as googleStartGet } from "@/app/api/auth/google/start/route";
import { isPreviewLoginRouteEnabled } from "@/app-auth/preview-login";
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

function setRequestHeaders(init: Record<string, string>) {
  routeMocks.headerMap.clear();
  for (const [key, value] of Object.entries(init)) {
    routeMocks.headerMap.set(key.toLowerCase(), value);
  }
}

describe("auth API routes (integration)", () => {
  beforeEach(() => {
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    };
    setRequestHeaders({ host: "localhost:3000" });
  });

  it("session returns 404 on production card host", async () => {
    setRequestHeaders({ host: "we-met.link" });
    routeMocks.env.WE_MET_ENV = "production";
    const response = await sessionGet();
    expect(response.status).toBe(404);
  });

  it("preview-login is 404 outside preview env", async () => {
    routeMocks.env.WE_MET_PREVIEW_LOGIN_SECRET = "sekrit";
    const response = await previewLoginPost(
      new Request("http://localhost:3000/api/auth/preview-login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ secret: "sekrit" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(
      isPreviewLoginRouteEnabled({
        WE_MET_ENV: "production",
        WE_MET_PREVIEW_LOGIN_SECRET: "x",
      }),
    ).toBe(false);
  });

  it("google start returns redirect with set-cookie", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      routeMocks.env.WE_MET_ENV = "production";
      setRequestHeaders({ host: "app.we-met.link" });
      const limiter = {
        calls: 0,
        async limit() {
          this.calls += 1;
          return { success: this.calls === 1 };
        },
      };
      routeMocks.env.WE_MET_AUTH_RATE_LIMITER = limiter;
      const ok = await googleStartGet(
        new Request("https://app.we-met.link/api/auth/google/start?mode=redirect"),
      );
      expect(ok.status).toBe(302);
      expect(ok.headers.get("set-cookie")).toContain("__Host-wm_oauth");
      const limited = await googleStartGet(
        new Request("https://app.we-met.link/api/auth/google/start?mode=redirect"),
      );
      expect(limited.status).toBe(429);
      routeMocks.env.WE_MET_ENV = "local";
      setRequestHeaders({ host: "localhost:3000" });
    });
  });

  it("logout rejects missing Origin and accepts valid mutation", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
        async limit() {
          return { success: true };
        },
      };
      const bad = await logoutPost(
        new Request("http://localhost:3000/api/auth/logout", { method: "POST" }),
      );
      expect(bad.status).toBe(403);
      const good = await logoutPost(
        new Request("http://localhost:3000/api/auth/logout", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          body: "{}",
        }),
      );
      expect(good.status).toBe(200);
    });
  });
});
