import { describe, expect, it, vi } from "vitest";
import {
  compareGoogleOAuthClientIds,
  googleClientIdLogSuffix,
  parseGoogleClientIdFromOAuthLocation,
} from "../scripts/lib/google-oauth-client-id-smoke.mjs";
import {
  fetchGoogleClientIdFromSignInStart,
  runGoogleOAuthClientIdSmoke,
} from "../scripts/check-google-oauth-client-ids.mjs";

const SAMPLE_LOCATION =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=123456789012-abcdefghijklmnop.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fexample&response_type=code&scope=openid";

describe("parseGoogleClientIdFromOAuthLocation (unit)", () => {
  it("parses client_id from a Google accounts Location header", () => {
    expect(parseGoogleClientIdFromOAuthLocation(SAMPLE_LOCATION)).toBe(
      "123456789012-abcdefghijklmnop.apps.googleusercontent.com",
    );
  });

  it("returns null when Location is missing or not Google accounts", () => {
    expect(parseGoogleClientIdFromOAuthLocation(null)).toBeNull();
    expect(parseGoogleClientIdFromOAuthLocation("")).toBeNull();
    expect(
      parseGoogleClientIdFromOAuthLocation("https://evil.example/oauth"),
    ).toBeNull();
  });

  it("returns null when client_id is missing from the redirect", () => {
    expect(
      parseGoogleClientIdFromOAuthLocation(
        "https://accounts.google.com/o/oauth2/v2/auth?response_type=code",
      ),
    ).toBeNull();
  });
});

describe("compareGoogleOAuthClientIds (unit)", () => {
  it("accepts different client ids", () => {
    expect(
      compareGoogleOAuthClientIds(
        "staging-client.apps.googleusercontent.com",
        "prod-client.apps.googleusercontent.com",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects equal client ids", () => {
    expect(
      compareGoogleOAuthClientIds(
        "same.apps.googleusercontent.com",
        "same.apps.googleusercontent.com",
      ),
    ).toEqual({ ok: false, reason: "equal" });
  });

  it("rejects unparsable ids", () => {
    expect(
      compareGoogleOAuthClientIds(null, "prod.apps.googleusercontent.com"),
    ).toEqual({
      ok: false,
      reason: "unparsable",
    });
  });
});

describe("googleClientIdLogSuffix (unit)", () => {
  it("logs only the last six characters", () => {
    expect(googleClientIdLogSuffix("abcdefghijklmnop.apps.googleusercontent.com")).toBe(
      "nt.com",
    );
  });
});

describe("runGoogleOAuthClientIdSmoke (unit)", () => {
  it("fails when a sign-in start response has no redirect", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    const result = await runGoogleOAuthClientIdSmoke(fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unparsable");
    }
  });

  it("passes when staging and production return different client ids", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const clientId = url.includes("we-met.didi.build")
        ? "111111111111-stagingid.apps.googleusercontent.com"
        : "222222222222-prodid.apps.googleusercontent.com";
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code`,
        },
      });
    });
    const result = await runGoogleOAuthClientIdSmoke(fetchImpl);
    expect(result).toEqual({
      ok: true,
      stagingSuffix: googleClientIdLogSuffix(
        "111111111111-stagingid.apps.googleusercontent.com",
      ),
      productionSuffix: googleClientIdLogSuffix(
        "222222222222-prodid.apps.googleusercontent.com",
      ),
    });
  });
});

describe("fetchGoogleClientIdFromSignInStart (unit)", () => {
  it("does not follow redirects", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      return new Response(null, {
        status: 302,
        headers: { Location: SAMPLE_LOCATION },
      });
    });
    await fetchGoogleClientIdFromSignInStart("https://example/start", fetchImpl);
  });
});
