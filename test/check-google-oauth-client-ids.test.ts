import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  compareStagingClientIdToProductionFingerprint,
  parseGoogleClientIdFromOAuthLocation,
  sha256HexClientId,
  stagingClientIdSha256LogPrefix,
} from "../scripts/lib/google-oauth-client-id-smoke.mjs";
import {
  fetchGoogleClientIdFromSignInStart,
  PROD_GOOGLE_CLIENT_ID_SHA256,
  runGoogleOAuthClientIdSmoke,
} from "../scripts/check-google-oauth-client-ids.mjs";

const SAMPLE_LOCATION =
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=123456789012-abcdefghijklmnop.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fexample&response_type=code&scope=openid";

const STAGING_ONLY_CLIENT_ID = "111111111111-stagingid.apps.googleusercontent.com";

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

describe("compareStagingClientIdToProductionFingerprint (unit)", () => {
  it("accepts a staging client id whose hash differs from production", () => {
    const fingerprint = sha256HexClientId(STAGING_ONLY_CLIENT_ID);
    const result = compareStagingClientIdToProductionFingerprint(
      STAGING_ONLY_CLIENT_ID,
      "0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(result).toEqual({ ok: true, logPrefix: fingerprint.slice(0, 8) });
  });

  it("rejects when staging hash equals the production fingerprint", () => {
    const clientId = "prod-match.apps.googleusercontent.com";
    const fingerprint = sha256HexClientId(clientId);
    expect(
      compareStagingClientIdToProductionFingerprint(clientId, fingerprint),
    ).toEqual({ ok: false, reason: "equal" });
  });

  it("rejects unparsable staging client id", () => {
    expect(
      compareStagingClientIdToProductionFingerprint(null, PROD_GOOGLE_CLIENT_ID_SHA256),
    ).toEqual({ ok: false, reason: "unparsable" });
  });
});

describe("stagingClientIdSha256LogPrefix (unit)", () => {
  it("logs the first eight hex characters of the SHA-256", () => {
    const prefix = stagingClientIdSha256LogPrefix(STAGING_ONLY_CLIENT_ID);
    expect(prefix).toHaveLength(8);
    expect(prefix).toBe(sha256HexClientId(STAGING_ONLY_CLIENT_ID).slice(0, 8));
    expect(prefix).not.toBe("nt.com");
  });
});

describe("runGoogleOAuthClientIdSmoke (unit)", () => {
  it("fails when staging sign-in start has no redirect", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
    const result = await runGoogleOAuthClientIdSmoke(fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unparsable");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("we-met.didi.build"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("passes when staging client id hash differs from production fingerprint", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${STAGING_ONLY_CLIENT_ID}&response_type=code`,
          },
        }),
    );
    const result = await runGoogleOAuthClientIdSmoke(
      fetchImpl,
      createHash("sha256").update("other-prod-client").digest("hex"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.logPrefix).toBe(
        stagingClientIdSha256LogPrefix(STAGING_ONLY_CLIENT_ID),
      );
    }
  });

  it("fails when staging client id matches the production fingerprint", async () => {
    const clientId = "matches-prod.apps.googleusercontent.com";
    const fingerprint = sha256HexClientId(clientId);
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code`,
          },
        }),
    );
    const result = await runGoogleOAuthClientIdSmoke(fetchImpl, fingerprint);
    expect(result).toEqual({ ok: false, reason: "equal" });
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
