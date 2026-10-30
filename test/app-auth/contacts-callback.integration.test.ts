import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as contactsCallbackGet } from "@/app/api/auth/google/contacts/callback/route";
import {
  CONTACTS_OAUTH_COOKIE_NAME,
  CONTACTS_SETUP_SUPPRESS_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/app-auth/cookies";
import { sha256Base64Url } from "@/app-auth/crypto";
import { createContactsOAuthAttempt } from "@/app-auth/contacts-oauth-attempts";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { createSession } from "@/app-auth/sessions";
import { clearLocalD1Tables, openIsolatedLocalD1 } from "../helpers/d1";

const routeMocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  headerMap: new Map<string, string>(),
}));

const oauthMocks = vi.hoisted(() => ({
  exchangeGoogleCodeForContactsAccessToken: vi.fn(),
  syncWeMetGoogleContact: vi.fn(),
}));

vi.mock("@/app-auth/google-contacts-oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app-auth/google-contacts-oauth")>();
  return {
    ...actual,
    exchangeGoogleCodeForContactsAccessToken:
      oauthMocks.exchangeGoogleCodeForContactsAccessToken,
  };
});

vi.mock("@/app-auth/google-people-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app-auth/google-people-api")>();
  return {
    ...actual,
    syncWeMetGoogleContact: oauthMocks.syncWeMetGoogleContact,
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

function setCookieHeader(parts: string[]) {
  setRequestHeaders({ host: "localhost:3000", cookie: parts.join("; ") });
}

function suppressCookieSet(response: Response): boolean {
  const raw =
    response.headers.getSetCookie?.().join("\n") ??
    response.headers.get("set-cookie") ??
    "";
  return raw.includes(`${CONTACTS_SETUP_SUPPRESS_COOKIE_NAME}=1`);
}

function suppressCookieAttributes(response: Response): string {
  return (
    response.headers.getSetCookie?.().join("\n") ??
    response.headers.get("set-cookie") ??
    ""
  );
}

async function seedEligibleOwner(db: import("@cloudflare/workers-types").D1Database) {
  const accountResult = await upsertAccountFromGoogle(db, {
    sub: "sub-1",
    email: "owner@example.com",
    name: "Owner",
  });
  if (!accountResult.ok) {
    throw new Error("account");
  }
  await db
    .prepare("UPDATE accounts SET status = 'active' WHERE id = ?")
    .bind(accountResult.account.id)
    .run();
  const session = await createSession(db, accountResult.account.id);
  return { accountId: accountResult.account.id, sessionToken: session.token };
}

let db: D1Database;
let closeD1: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const handle = await openIsolatedLocalD1();
  db = handle.db;
  closeD1 = handle.close;
});

afterAll(async () => {
  await closeD1?.();
});

describe("contacts OAuth callback (integration)", () => {
  beforeEach(async () => {
    await clearLocalD1Tables(db);
    oauthMocks.exchangeGoogleCodeForContactsAccessToken.mockReset();
    oauthMocks.syncWeMetGoogleContact.mockReset();
    routeMocks.env = {
      WE_MET_BASE_URL: "https://we-met.link",
      WE_MET_ENV: "local",
      WE_MET_APP_ORIGIN: "http://localhost:3000",
      WE_MET_PREVIEW_HOST_SUFFIX: "",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      WE_MET_CONTACT_SENDER_ADDRESSES: "hello@we-met.link,hello@mail.we-met.link",
      CONTACTS_SETUP_ALLOWLIST: "owner@example.com",
      CONTACTS_SETUP_ENABLED_FOR_ALL: "false",
    };
    setRequestHeaders({ host: "localhost:3000" });
    routeMocks.env.WE_MET_DB = db;
  });

  it("does not persist the Google access token in D1", async () => {
    const { accountId, sessionToken } = await seedEligibleOwner(db);
    const state = "state-plain";
    await createContactsOAuthAttempt(db, {
      state,
      accountId,
      pkceVerifier: "verifier",
    });

    oauthMocks.exchangeGoogleCodeForContactsAccessToken.mockResolvedValue({
      accessToken: "ya29.super-secret-token",
    });
    oauthMocks.syncWeMetGoogleContact.mockResolvedValue({
      ok: true,
      addressesAdded: ["hello@we-met.link", "hello@mail.we-met.link"],
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
    ]);

    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.status).toBe(302);

    for (const call of [...logSpy.mock.calls, ...errorSpy.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain("ya29.super-secret-token");
    }
    logSpy.mockRestore();
    errorSpy.mockRestore();

    const accountRow = await db
      .prepare("SELECT contact_sender_addresses, contact_added_at FROM accounts")
      .all<{
        contact_sender_addresses: string | null;
        contact_added_at: string | null;
      }>();
    for (const row of accountRow.results ?? []) {
      expect(JSON.stringify(row)).not.toContain("ya29.super-secret-token");
    }
  });

  for (const oauthError of ["access_denied", "admin_enforced"] as const) {
    it(`sets suppress cookie on ${oauthError} when state matches and session is valid`, async () => {
      const { accountId, sessionToken } = await seedEligibleOwner(db);
      const state = `decline-${oauthError}`;
      await createContactsOAuthAttempt(db, {
        state,
        accountId,
        pkceVerifier: "verifier",
      });
      setCookieHeader([
        `${SESSION_COOKIE_NAME}=${sessionToken}`,
        `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
      ]);
      const response = await contactsCallbackGet(
        new Request(
          `http://localhost:3000/api/auth/google/contacts/callback?error=${oauthError}&state=${state}`,
        ),
      );
      expect(response.status).toBe(302);
      expect(suppressCookieSet(response)).toBe(true);
      const attrs = suppressCookieAttributes(response);
      expect(attrs).toContain("HttpOnly");
      expect(attrs).toContain("Secure");
      expect(attrs).toContain("SameSite=Lax");
      expect(attrs).toContain("Path=/");
      const row = await db
        .prepare("SELECT contact_added_at FROM accounts WHERE id = ?")
        .bind(accountId)
        .first<{ contact_added_at: string | null }>();
      expect(row?.contact_added_at).toBeNull();
    });
  }

  it("does not set suppress cookie when decline state does not match cookie", async () => {
    const { sessionToken } = await seedEligibleOwner(db);
    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=other-state`,
    ]);
    const response = await contactsCallbackGet(
      new Request(
        "http://localhost:3000/api/auth/google/contacts/callback?error=access_denied&state=query-state",
      ),
    );
    expect(suppressCookieSet(response)).toBe(false);
  });

  it("declines without suppress when session cookie is missing", async () => {
    const { accountId } = await seedEligibleOwner(db);
    const state = "no-session";
    await createContactsOAuthAttempt(db, {
      state,
      accountId,
      pkceVerifier: "verifier",
    });
    setCookieHeader([`${CONTACTS_OAUTH_COOKIE_NAME}=${state}`]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toContain("contacts_setup=declined");
    expect(suppressCookieSet(response)).toBe(false);
    expect(oauthMocks.exchangeGoogleCodeForContactsAccessToken).not.toHaveBeenCalled();
    const row = await db
      .prepare("SELECT contact_added_at FROM accounts WHERE id = ?")
      .bind(accountId)
      .first<{ contact_added_at: string | null }>();
    expect(row?.contact_added_at).toBeNull();
  });

  it("declines without suppress when session belongs to a different account", async () => {
    const { accountId: attemptAccountId } = await seedEligibleOwner(db);
    const other = await upsertAccountFromGoogle(db, {
      sub: "sub-other",
      email: "other@example.com",
      name: "Other",
    });
    if (!other.ok) {
      throw new Error("other account");
    }
    await db
      .prepare("UPDATE accounts SET status = 'active' WHERE id = ?")
      .bind(other.account.id)
      .run();
    routeMocks.env.CONTACTS_SETUP_ALLOWLIST = "owner@example.com,other@example.com";
    const otherSession = await createSession(db, other.account.id);

    const state = "wrong-session";
    await createContactsOAuthAttempt(db, {
      state,
      accountId: attemptAccountId,
      pkceVerifier: "verifier",
    });
    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${otherSession.token}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
    ]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toContain("contacts_setup=declined");
    expect(suppressCookieSet(response)).toBe(false);
    expect(oauthMocks.exchangeGoogleCodeForContactsAccessToken).not.toHaveBeenCalled();
    const row = await db
      .prepare("SELECT contact_added_at FROM accounts WHERE id = ?")
      .bind(attemptAccountId)
      .first<{ contact_added_at: string | null }>();
    expect(row?.contact_added_at).toBeNull();
  });

  it("declines when contacts OAuth cookie is missing", async () => {
    const { accountId, sessionToken } = await seedEligibleOwner(db);
    const state = "state-only";
    await createContactsOAuthAttempt(db, {
      state,
      accountId,
      pkceVerifier: "verifier",
    });
    setCookieHeader([`${SESSION_COOKIE_NAME}=${sessionToken}`]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toContain("contacts_setup=declined");
    expect(suppressCookieSet(response)).toBe(false);
  });

  it("declines when the oauth attempt is expired", async () => {
    const { accountId, sessionToken } = await seedEligibleOwner(db);
    const state = "expired";
    const stateHash = await sha256Base64Url(state);
    await db
      .prepare(
        `INSERT INTO contacts_oauth_attempts (state_hash, account_id, pkce_verifier, created_at, expires_at)
           VALUES (?, ?, 'v', '2020-01-01T00:00:00.000Z', '2020-01-01T00:10:00.000Z')`,
      )
      .bind(stateHash, accountId)
      .run();
    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
    ]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toContain("contacts_setup=declined");
  });

  it("declines when token exchange fails", async () => {
    const { accountId, sessionToken } = await seedEligibleOwner(db);
    const state = "exchange-fail";
    await createContactsOAuthAttempt(db, {
      state,
      accountId,
      pkceVerifier: "verifier",
    });
    oauthMocks.exchangeGoogleCodeForContactsAccessToken.mockResolvedValue({
      error: "token_exchange_failed",
    });
    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
    ]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toContain("contacts_setup=declined");
    const row = await db
      .prepare("SELECT contact_added_at FROM accounts WHERE id = ?")
      .bind(accountId)
      .first<{ contact_added_at: string | null }>();
    expect(row?.contact_added_at).toBeNull();
  });

  it("declines quietly with suppress when contacts scope is missing from token response", async () => {
    const { accountId, sessionToken } = await seedEligibleOwner(db);
    const state = "missing-scope";
    await createContactsOAuthAttempt(db, {
      state,
      accountId,
      pkceVerifier: "verifier",
    });
    oauthMocks.exchangeGoogleCodeForContactsAccessToken.mockResolvedValue({
      error: "missing_contacts_scope",
    });
    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
    ]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(suppressCookieSet(response)).toBe(true);
  });

  it("declined redirect on staging uses the staging /app origin", async () => {
    try {
      routeMocks.env.WE_MET_BASE_URL = "https://we-met.didi.build";
      routeMocks.env.WE_MET_ENV = "staging";
      setRequestHeaders({ host: "we-met.didi.build" });
      const response = await contactsCallbackGet(
        new Request(
          "https://we-met.didi.build/api/auth/google/contacts/callback?error=access_denied&state=declined",
        ),
      );
      expect(response.status).toBe(302);
      const location = response.headers.get("location") ?? "";
      expect(location.startsWith("https://we-met.didi.build/app")).toBe(true);
      expect(location).toContain("contacts_setup=declined");
    } finally {
      routeMocks.env = {
        WE_MET_BASE_URL: "https://we-met.link",
        WE_MET_ENV: "local",
        WE_MET_APP_ORIGIN: "http://localhost:3000",
        WE_MET_PREVIEW_HOST_SUFFIX: "",
        GOOGLE_CLIENT_ID: "client",
        GOOGLE_CLIENT_SECRET: "secret",
        WE_MET_CONTACT_SENDER_ADDRESSES: "hello@we-met.link,hello@mail.we-met.link",
        CONTACTS_SETUP_ALLOWLIST: "owner@example.com",
        CONTACTS_SETUP_ENABLED_FOR_ALL: "false",
      };
      setRequestHeaders({ host: "localhost:3000" });
    }
  });

  it("declines when People API sync fails", async () => {
    const { accountId, sessionToken } = await seedEligibleOwner(db);
    const state = "people-fail";
    await createContactsOAuthAttempt(db, {
      state,
      accountId,
      pkceVerifier: "verifier",
    });
    oauthMocks.exchangeGoogleCodeForContactsAccessToken.mockResolvedValue({
      accessToken: "ya29.token",
    });
    oauthMocks.syncWeMetGoogleContact.mockResolvedValue({
      ok: false,
      reason: "people_api_failed",
    });
    setCookieHeader([
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
    ]);
    const response = await contactsCallbackGet(
      new Request(
        `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toContain("contacts_setup=declined");
    const row = await db
      .prepare("SELECT contact_added_at FROM accounts WHERE id = ?")
      .bind(accountId)
      .first<{ contact_added_at: string | null }>();
    expect(row?.contact_added_at).toBeNull();
  });
});
