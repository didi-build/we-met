import { afterEach, describe, expect, it, vi } from "vitest";
import { createCloudflareTurnstileVerifier } from "@/exchange/turnstile";

describe("Cloudflare Turnstile verifier (unit)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns success when siteverify succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const logger = { logSiteverifyErrors: vi.fn() };
    const verifier = createCloudflareTurnstileVerifier("my-secret", logger);
    const result = await verifier.verify("visitor-token", "203.0.113.1");

    expect(result.success).toBe(true);
    expect(logger.logSiteverifyErrors).not.toHaveBeenCalled();

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as URLSearchParams;
    expect(body.get("secret")).toBe("my-secret");
    expect(body.get("response")).toBe("visitor-token");
    expect(body.get("remoteip")).toBe("203.0.113.1");
  });

  it("omits remoteip when client IP is null", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const verifier = createCloudflareTurnstileVerifier("my-secret", {
      logSiteverifyErrors: vi.fn(),
    });
    await verifier.verify("visitor-token", null);

    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as URLSearchParams;
    expect(body.has("remoteip")).toBe(false);
  });

  it("logs siteverify error codes without secret or token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const logSiteverifyErrors = vi.fn();
    const verifier = createCloudflareTurnstileVerifier("my-secret", {
      logSiteverifyErrors,
    });
    const result = await verifier.verify("visitor-token", "203.0.113.1");

    expect(result.success).toBe(false);
    expect(logSiteverifyErrors).toHaveBeenCalledWith(["invalid-input-response"]);
    const logged = JSON.stringify(logSiteverifyErrors.mock.calls);
    expect(logged).not.toContain("my-secret");
    expect(logged).not.toContain("visitor-token");
  });

  it("logs http status on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    vi.stubGlobal("fetch", fetchMock);

    const logSiteverifyErrors = vi.fn();
    const verifier = createCloudflareTurnstileVerifier("my-secret", {
      logSiteverifyErrors,
    });
    const result = await verifier.verify("visitor-token", null);

    expect(result.success).toBe(false);
    expect(logSiteverifyErrors).toHaveBeenCalledWith(["http-503"]);
  });
});
