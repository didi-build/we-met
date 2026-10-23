import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as contactsCallbackGet } from "@/app/api/auth/google/contacts/callback/route";
import { CONTACTS_OAUTH_COOKIE_NAME } from "@/app-auth/cookies";
import { createContactsOAuthAttempt } from "@/app-auth/contacts-oauth-attempts";
import { upsertAccountFromGoogle } from "@/app-auth/accounts";
import { withIsolatedLocalD1 } from "../helpers/d1";

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

describe("contacts OAuth callback (integration)", () => {
  beforeEach(() => {
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
  });

  it("does not persist the Google access token in D1", async () => {
    await withIsolatedLocalD1(async (db) => {
      routeMocks.env.WE_MET_DB = db;
      const accountResult = await upsertAccountFromGoogle(db, {
        sub: "sub-1",
        email: "owner@example.com",
        name: "Owner",
      });
      expect(accountResult.ok).toBe(true);
      if (!accountResult.ok) {
        return;
      }

      const state = "state-plain";
      await createContactsOAuthAttempt(db, {
        state,
        accountId: accountResult.account.id,
        pkceVerifier: "verifier",
      });

      oauthMocks.exchangeGoogleCodeForContactsAccessToken.mockResolvedValue({
        accessToken: "ya29.super-secret-token",
      });
      oauthMocks.syncWeMetGoogleContact.mockResolvedValue({
        ok: true,
        addressesAdded: ["hello@we-met.link", "hello@mail.we-met.link"],
      });

      setRequestHeaders({
        host: "localhost:3000",
        cookie: `${CONTACTS_OAUTH_COOKIE_NAME}=${state}`,
      });

      const response = await contactsCallbackGet(
        new Request(
          `http://localhost:3000/api/auth/google/contacts/callback?code=abc&state=${state}`,
        ),
      );
      expect(response.status).toBe(302);

      const accounts = await db
        .prepare(
          "SELECT id, email, contact_sender_addresses, contact_added_at FROM accounts",
        )
        .all<Record<string, unknown>>();
      const oauthRows = await db
        .prepare(
          "SELECT state_hash, account_id, pkce_verifier FROM contacts_oauth_attempts",
        )
        .all<Record<string, unknown>>();
      for (const row of [...(accounts.results ?? []), ...(oauthRows.results ?? [])]) {
        expect(JSON.stringify(row)).not.toContain("ya29.super-secret-token");
      }

      const accountRow = await db
        .prepare("SELECT contact_sender_addresses FROM accounts WHERE id = ?")
        .bind(accountResult.account.id)
        .first<{ contact_sender_addresses: string }>();
      expect(accountRow?.contact_sender_addresses).toContain("hello@we-met.link");
    });
  });
});
