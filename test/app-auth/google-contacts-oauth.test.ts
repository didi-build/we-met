import { describe, expect, it } from "vitest";
import { buildGoogleContactsAuthUrl } from "@/app-auth/google-contacts-oauth";

describe("google contacts OAuth URL (unit)", () => {
  it("requests only the contacts scope with include_granted_scopes and no offline access", () => {
    const url = buildGoogleContactsAuthUrl({
      clientId: "client-id",
      redirectUri: "https://app.we-met.link/api/auth/google/contacts/callback",
      state: "state-token",
      codeChallenge: "challenge",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(parsed.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/contacts",
    );
    expect(parsed.searchParams.get("include_granted_scopes")).toBe("true");
    expect(parsed.searchParams.has("access_type")).toBe(false);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });
});
