import { describe, expect, it } from "vitest";
import { createAuthRateLimiter } from "@/app-auth/rate-limit";

describe("auth rate limiter (unit)", () => {
  it("keys limits per route and IP", async () => {
    const keys: string[] = [];
    const limiter = createAuthRateLimiter(
      {
        async limit(options) {
          keys.push(options.key);
          return { success: keys.filter((k) => k === options.key).length === 1 };
        },
      },
      "preview",
    );
    expect(await limiter.check("session", "1.2.3.4")).toBe(true);
    expect(await limiter.check("session", "1.2.3.4")).toBe(false);
    expect(await limiter.check("google-start", "1.2.3.4")).toBe(true);
    expect(keys).toContain("auth:session:1.2.3.4");
    expect(keys).toContain("auth:google-start:1.2.3.4");
  });
});
