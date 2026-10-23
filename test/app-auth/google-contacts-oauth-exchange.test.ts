import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accessTokenResponseIncludesContactsScope,
  exchangeGoogleCodeForContactsAccessToken,
} from "@/app-auth/google-contacts-oauth";
import { contactsOAuthScope } from "@/app-auth/contacts-setup-config";

const fetchMock = vi.fn();

describe("google contacts token exchange (unit)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("requires the contacts scope in the token response", () => {
    expect(
      accessTokenResponseIncludesContactsScope(`openid email ${contactsOAuthScope()}`),
    ).toBe(true);
    expect(accessTokenResponseIncludesContactsScope("openid email")).toBe(false);
    expect(accessTokenResponseIncludesContactsScope(undefined)).toBe(false);
  });

  it("returns missing_contacts_scope when scope is absent", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "token",
        scope: "openid email",
      }),
    });
    const result = await exchangeGoogleCodeForContactsAccessToken({
      code: "c",
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://app.we-met.link/cb",
      codeVerifier: "v",
    });
    expect(result).toEqual({ error: "missing_contacts_scope" });
  });

  it("returns access token when contacts scope is granted", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "token",
        scope: contactsOAuthScope(),
      }),
    });
    const result = await exchangeGoogleCodeForContactsAccessToken({
      code: "c",
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://app.we-met.link/cb",
      codeVerifier: "v",
    });
    expect(result).toEqual({ accessToken: "token" });
  });
});
