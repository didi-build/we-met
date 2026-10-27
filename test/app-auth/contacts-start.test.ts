import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as contactsStartGet } from "@/app/api/auth/google/contacts/start/route";
import { CONTACTS_OAUTH_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { createSession } from "@/app-auth/sessions";
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

function defaultContactsRouteEnv(): Record<string, unknown> {
  return {
    WE_MET_BASE_URL: "https://we-met.link",
    WE_MET_ENV: "local",
    WE_MET_APP_ORIGIN: "http://localhost:3000",
    WE_MET_PREVIEW_HOST_SUFFIX: "",
    GOOGLE_CLIENT_ID: "client",
    GOOGLE_CLIENT_SECRET: "secret",
    WE_MET_CONTACT_SENDER_ADDRESSES: "hello@we-met.link",
    CONTACTS_SETUP_ALLOWLIST: "owner@example.com",
    CONTACTS_SETUP_ENABLED_FOR_ALL: "false",
  };
}

function restoreDefaultContactsRouteEnv() {
  routeMocks.env = defaultContactsRouteEnv();
  setRequestHeaders({ host: "localhost:3000" });
}

describe("contacts OAuth start (integration)", () => {
  beforeEach(() => {
    restoreDefaultContactsRouteEnv();
  });

  afterEach(() => {
    restoreDefaultContactsRouteEnv();
  });

  it("returns 401 without a session cookie", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const response = await contactsStartGet(
        new Request("http://localhost:3000/api/auth/google/contacts/start"),
      );
      expect(response.status).toBe(401);
    });
  });

  it("returns 403 when the owner is not on the allowlist", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const account = await upsertAccountFromGoogle(db, {
        sub: "sub",
        email: "stranger@example.com",
        name: "Stranger",
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
      const response = await contactsStartGet(
        new Request("http://localhost:3000/api/auth/google/contacts/start"),
      );
      expect(response.status).toBe(403);
    });
  });

  it("returns 404 on preview env and allows staging", async () => {
    try {
      routeMocks.env.WE_MET_ENV = "preview";
      setRequestHeaders({ host: "pr-1-we-met-preview.example.workers.dev" });
      const response = await contactsStartGet(
        new Request(
          "https://pr-1-we-met-preview.example.workers.dev/api/auth/google/contacts/start",
        ),
      );
      expect(response.status).toBe(404);

      routeMocks.env.WE_MET_BASE_URL = "https://we-met.didi.build";
      routeMocks.env.WE_MET_ENV = "staging";
      setRequestHeaders({ host: "we-met.didi.build" });
      const stagingWithoutSession = await contactsStartGet(
        new Request("https://we-met.didi.build/api/auth/google/contacts/start"),
      );
      expect(stagingWithoutSession.status).toBe(401);
    } finally {
      restoreDefaultContactsRouteEnv();
    }
  });

  it("staging contacts start uses the card host OAuth redirect URI when eligible", async () => {
    await withIsolatedLocalD1(async (db) => {
      try {
        routeMocks.env = {
          ...defaultContactsRouteEnv(),
          WE_MET_DB: db,
          WE_MET_BASE_URL: "https://we-met.didi.build",
          WE_MET_ENV: "staging",
        };
        const account = await upsertAccountFromGoogle(db, {
          sub: "sub-staging-contacts",
          email: "owner@example.com",
          name: "Owner",
        });
        expect(account.ok).toBe(true);
        if (!account.ok) {
          return;
        }
        await db
          .prepare("UPDATE accounts SET status = 'active' WHERE id = ?")
          .bind(account.account.id)
          .run();
        const session = await createSession(db, account.account.id);
        setRequestHeaders({
          host: "we-met.didi.build",
          cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
        });
        const response = await contactsStartGet(
          new Request("https://we-met.didi.build/api/auth/google/contacts/start"),
        );
        expect(response.status).toBe(302);
        const location = response.headers.get("location") ?? "";
        const redirectUri = new URL(location).searchParams.get("redirect_uri");
        expect(redirectUri).toBe(
          "https://we-met.didi.build/api/auth/google/contacts/callback",
        );
      } finally {
        restoreDefaultContactsRouteEnv();
      }
    });
  });

  it("redirects with contacts OAuth cookie attributes when eligible", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const account = await upsertAccountFromGoogle(db, {
        sub: "sub-eligible",
        email: "owner@example.com",
        name: "Owner",
      });
      expect(account.ok).toBe(true);
      if (!account.ok) {
        return;
      }
      await db
        .prepare("UPDATE accounts SET status = 'active' WHERE id = ?")
        .bind(account.account.id)
        .run();
      const session = await createSession(db, account.account.id);
      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${session.token}`,
      });
      const response = await contactsStartGet(
        new Request("http://localhost:3000/api/auth/google/contacts/start"),
      );
      expect(response.status).toBe(302);
      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain(`${CONTACTS_OAUTH_COOKIE_NAME}=`);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Max-Age=");
    });
  });
});
