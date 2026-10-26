import { afterEach, describe, expect, it, vi } from "vitest";

describe("next.config staging build guard (unit)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when WE_MET_ENV is staging and WE_MET_BASE_URL is unset", async () => {
    vi.stubEnv("WE_MET_ENV", "staging");
    vi.stubEnv("WE_MET_BASE_URL", "");
    await expect(import("../../next.config")).rejects.toThrow(
      /WE_MET_BASE_URL is required when WE_MET_ENV is staging/,
    );
  });

  it("headers() returns no rules when WE_MET_ENV is unset (production default)", async () => {
    vi.unstubAllEnvs();
    delete process.env.WE_MET_ENV;
    vi.resetModules();
    const mod = await import("../../next.config");
    const headers = await mod.default.headers?.();
    expect(headers).toEqual([]);
  });
});
