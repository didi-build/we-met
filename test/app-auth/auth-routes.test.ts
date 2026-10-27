import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as sessionGet } from "@/app/api/app/session/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as previewLoginPost } from "@/app/api/auth/preview-login/route";
import { GET as googleCallbackGet } from "@/app/api/auth/google/callback/route";
import { GET as googleStartGet } from "@/app/api/auth/google/start/route";
import {
  OAUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  clearOAuthCookieValue,
} from "@/app-auth/cookies";
import { isPreviewLoginRouteEnabled } from "@/app-auth/preview-login";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { exchangeGoogleCode, verifyGoogleIdToken } from "@/app-auth/google-oauth";
import { createOAuthAttempt, createSession } from "@/app-auth/sessions";
import { withIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
}));

const googleOAuthMocks = vi.hoisted(() => ({
  exchangeGoogleCode: vi.fn(),
  verifyGoogleIdToken: vi.fn(),
}));

vi.mock("@/app-auth/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app-auth/google-oauth")>();
  return {
    ...actual,
    exchangeGoogleCode: googleOAuthMocks.exchangeGoogleCode,
    verifyGoogleIdToken: googleOAuthMocks.verifyGoogleIdToken,
  };
});

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

function defaultRouteEnv(): Record<string, unknown> {
  return {
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "local",
    WE_MET_APP_ORIGIN: "http://localhost:3000",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
  };
}

function restoreDefaultRouteEnv() {
  routeMocks.env = defaultRouteEnv();
  setRequestHeaders({ host: "localhost:3000" });
}

describe("auth API routes (integration)", () => {
  beforeEach(() => {
    googleOAuthMocks.exchangeGoogleCode.mockReset();
    googleOAuthMocks.verifyGoogleIdToken.mockReset();
    restoreDefaultRouteEnv();
  });

  afterEach(() => {
    restoreDefaultRouteEnv();
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

  async function runGoogleCallbackOnAppHost(
    db: import("@cloudflare/workers-types").D1Database,
    requestInit: { url: string; cookie?: string },
  ) {
    routeMocks.env.WE_MET_DB = db;
    routeMocks.env.WE_MET_ENV = "production";
    routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
      async limit() {
        return { success: true };
      },
    };
    const headers: Record<string, string> = { host: "app.we-met.link" };
    if (requestInit.cookie) {
      headers.cookie = requestInit.cookie;
    }
    setRequestHeaders(headers);
    const response = await googleCallbackGet(new Request(requestInit.url));
    routeMocks.env.WE_MET_ENV = "local";
    setRequestHeaders({ host: "localhost:3000" });
    return response;
  }

  function expectClearsOAuthCookie(response: Response) {
    const cookies = response.headers.getSetCookie?.() ?? [];
    const joined =
      cookies.length > 0
        ? cookies.join("\n")
        : (response.headers.get("set-cookie") ?? "");
    expect(joined).toContain(clearOAuthCookieValue().split(";")[0]);
  }

  it("google callback redirects with auth_error=failed when OAuth cookie is missing (route handler)", async () => {
    await withIsolatedLocalD1(async (db) => {
      const response = await runGoogleCallbackOnAppHost(db, {
        url: "https://app.we-met.link/api/auth/google/callback?code=fake&state=query-state",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("auth_error=failed");
      expectClearsOAuthCookie(response);
    });
  });

  it("google callback redirects with auth_error=failed when OAuth state mismatches cookie (route handler)", async () => {
    await withIsolatedLocalD1(async (db) => {
      const response = await runGoogleCallbackOnAppHost(db, {
        url: "https://app.we-met.link/api/auth/google/callback?code=fake&state=query-state",
        cookie: `${OAUTH_COOKIE_NAME}=not-the-query-state`,
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("auth_error=failed");
      expectClearsOAuthCookie(response);
    });
  });

  it("google callback redirect mode sets session cookie and clears oauth cookie (route handler)", async () => {
    await withIsolatedLocalD1(async (db) => {
      const state = "oauth-state-redirect";
      const nonce = "nonce-redirect";
      const verifier = "pkce-verifier-redirect";
      await createOAuthAttempt(db, {
        state,
        nonce,
        pkceVerifier: verifier,
        mode: "redirect",
      });
      googleOAuthMocks.exchangeGoogleCode.mockResolvedValue({ idToken: "id.jwt" });
      googleOAuthMocks.verifyGoogleIdToken.mockResolvedValue({
        sub: "google-sub-cb",
        email: "cb@example.com",
        name: "Callback",
      });

      const response = await runGoogleCallbackOnAppHost(db, {
        url: `https://app.we-met.link/api/auth/google/callback?code=auth-code&state=${state}`,
        cookie: `${OAUTH_COOKIE_NAME}=${state}`,
      });

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).not.toContain("auth_error");
      const cookies = response.headers.getSetCookie?.() ?? [];
      const joined = cookies.join("\n");
      expect(joined).toContain(SESSION_COOKIE_NAME);
      expectClearsOAuthCookie(response);
      expect(exchangeGoogleCode).toHaveBeenCalled();
      expect(verifyGoogleIdToken).toHaveBeenCalled();
    });
  });

  it("google callback popup mode returns result HTML and session cookie (route handler)", async () => {
    await withIsolatedLocalD1(async (db) => {
      const state = "oauth-state-popup";
      await createOAuthAttempt(db, {
        state,
        nonce: "nonce-popup",
        pkceVerifier: "pkce-verifier-popup",
        mode: "popup",
      });
      googleOAuthMocks.exchangeGoogleCode.mockResolvedValue({ idToken: "id.jwt" });
      googleOAuthMocks.verifyGoogleIdToken.mockResolvedValue({
        sub: "google-sub-popup",
        email: "popup@example.com",
        name: "Popup",
      });

      const response = await runGoogleCallbackOnAppHost(db, {
        url: `https://app.we-met.link/api/auth/google/callback?code=auth-code&state=${state}`,
        cookie: `${OAUTH_COOKIE_NAME}=${state}`,
      });

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("we-met-auth");
      const cookies = response.headers.getSetCookie?.() ?? [];
      const joined = cookies.join("\n");
      expect(joined).toContain(SESSION_COOKIE_NAME);
      expectClearsOAuthCookie(response);
    });
  });

  it("session GET re-issues Set-Cookie when a valid session exists (route handler)", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
        async limit() {
          return { success: true };
        },
      };
      const account = await upsertAccountFromGoogle(db, {
        sub: "route-session",
        email: "route@example.com",
        name: "Route",
      });
      expect(account.ok).toBe(true);
      if (!account.ok) {
        return;
      }
      const session = await createSession(db, account.account.id);
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await sessionGet();
      expect(response.status).toBe(200);
      const body = (await response.json()) as { session: { email: string } | null };
      expect(body.session?.email).toBe("route@example.com");
      expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
    });
  });

  it("preview-login succeeds on preview env with matching secret (route handler)", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      routeMocks.env.WE_MET_ENV = "preview";
      routeMocks.env.WE_MET_PREVIEW_LOGIN_SECRET = "preview-secret";
      routeMocks.env.WE_MET_PREVIEW_LOGIN_EMAIL = "preview@test.we-met.link";
      routeMocks.env.WE_MET_PREVIEW_HOST_SUFFIX =
        "-we-met-preview.diademshoukralla.workers.dev";
      routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
        async limit() {
          return { success: true };
        },
      };
      const previewHost = "pr-36-we-met-preview.diademshoukralla.workers.dev";
      setRequestHeaders({ host: previewHost });
      const response = await previewLoginPost(
        new Request(`https://${previewHost}/api/auth/preview-login`, {
          method: "POST",
          headers: {
            origin: `https://${previewHost}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ secret: "preview-secret" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE_NAME);
      routeMocks.env.WE_MET_ENV = "local";
      setRequestHeaders({ host: "localhost:3000" });
    });
  });

  it("google start returns 404 on preview env", async () => {
    try {
      routeMocks.env.WE_MET_ENV = "preview";
      routeMocks.env.WE_MET_PREVIEW_HOST_SUFFIX = "-we-met-preview.example.workers.dev";
      setRequestHeaders({ host: "pr-1-we-met-preview.example.workers.dev" });
      const response = await googleStartGet(
        new Request(
          "https://pr-1-we-met-preview.example.workers.dev/api/auth/google/start?mode=redirect",
        ),
      );
      expect(response.status).toBe(404);
    } finally {
      restoreDefaultRouteEnv();
    }
  });

  it("google callback access_denied on staging redirects to /app on the staging origin", async () => {
    try {
      routeMocks.env.WE_MET_DB = undefined;
      routeMocks.env.WE_MET_BASE_URL = "https://we-met.didi.build";
      routeMocks.env.WE_MET_ENV = "staging";
      routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
        async limit() {
          return { success: true };
        },
      };
      setRequestHeaders({ host: "we-met.didi.build" });
      const response = await googleCallbackGet(
        new Request(
          "https://we-met.didi.build/api/auth/google/callback?error=access_denied&state=declined",
        ),
      );
      expect(response.status).toBe(302);
      const location = response.headers.get("location") ?? "";
      expect(location.startsWith("https://we-met.didi.build/app")).toBe(true);
      expect(location).toContain("auth_error=canceled");
    } finally {
      restoreDefaultRouteEnv();
    }
  });

  it("google start on staging uses the card host OAuth redirect URI", async () => {
    await withIsolatedLocalD1(async (db) => {
      try {
        routeMocks.env.WE_MET_DB = db;
        routeMocks.env.WE_MET_BASE_URL = "https://we-met.didi.build";
        routeMocks.env.WE_MET_ENV = "staging";
        routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
          async limit() {
            return { success: true };
          },
        };
        setRequestHeaders({ host: "we-met.didi.build" });
        const response = await googleStartGet(
          new Request("https://we-met.didi.build/api/auth/google/start?mode=redirect"),
        );
        expect(response.status).toBe(302);
        const location = response.headers.get("location") ?? "";
        const redirectUri = new URL(location).searchParams.get("redirect_uri");
        expect(redirectUri).toBe("https://we-met.didi.build/api/auth/google/callback");
      } finally {
        restoreDefaultRouteEnv();
      }
    });
  });

  it("session GET is served on the staging card host", async () => {
    await withIsolatedLocalD1(async (db) => {
      try {
        routeMocks.env.WE_MET_DB = db;
        routeMocks.env.WE_MET_BASE_URL = "https://we-met.didi.build";
        routeMocks.env.WE_MET_ENV = "staging";
        routeMocks.env.WE_MET_AUTH_RATE_LIMITER = {
          async limit() {
            return { success: true };
          },
        };
        setRequestHeaders({ host: "we-met.didi.build" });
        const response = await sessionGet();
        expect(response.status).toBe(200);
      } finally {
        restoreDefaultRouteEnv();
      }
    });
  });

  it("preview-login is 404 on staging env", async () => {
    try {
      routeMocks.env.WE_MET_BASE_URL = "https://we-met.didi.build";
      routeMocks.env.WE_MET_ENV = "staging";
      routeMocks.env.WE_MET_PREVIEW_LOGIN_SECRET = "sekrit";
      setRequestHeaders({ host: "we-met.didi.build" });
      const response = await previewLoginPost(
        new Request("https://we-met.didi.build/api/auth/preview-login", {
          method: "POST",
          headers: {
            origin: "https://we-met.didi.build",
            "content-type": "application/json",
          },
          body: JSON.stringify({ secret: "sekrit" }),
        }),
      );
      expect(response.status).toBe(404);
    } finally {
      restoreDefaultRouteEnv();
    }
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
