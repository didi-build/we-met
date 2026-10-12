import { describe, expect, it, vi } from "vitest";
import {
  MissingRateLimiterBindingError,
  selectExchangeRateLimiter,
  selectTurnstileVerifier,
} from "@/exchange/runtime-adapters";

describe("runtime adapter selection (unit)", () => {
  const logger = { logSiteverifyErrors: vi.fn() };

  it("uses no-op rate limiter and always-pass Turnstile on local", async () => {
    const limiter = selectExchangeRateLimiter("local", undefined);
    await expect(limiter.check("1.2.3.4")).resolves.toEqual({ allowed: true });

    const turnstile = selectTurnstileVerifier("local", undefined, logger);
    await expect(turnstile.verify("any", null)).resolves.toEqual({ success: true });
  });

  it("throws when non-local is missing the rate limiter binding", () => {
    expect(() => selectExchangeRateLimiter("preview", undefined)).toThrow(
      MissingRateLimiterBindingError,
    );
    expect(() => selectExchangeRateLimiter("production", undefined)).toThrow(
      MissingRateLimiterBindingError,
    );
  });

  it("throws when non-local is missing Turnstile secret", () => {
    expect(() => selectTurnstileVerifier("preview", undefined, logger)).toThrow(
      /TURNSTILE_SECRET_KEY/,
    );
  });

  it("returns real adapters when non-local bindings and secrets are present", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const limiter = selectExchangeRateLimiter("preview", { limit });
    await limiter.check("203.0.113.1");
    expect(limit).toHaveBeenCalledWith({ key: "203.0.113.1" });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const turnstile = selectTurnstileVerifier("preview", "secret-key", logger);
    const result = await turnstile.verify("token", "203.0.113.1");
    expect(result.success).toBe(true);

    vi.unstubAllGlobals();
  });
});
