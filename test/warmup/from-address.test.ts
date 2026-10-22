import { describe, expect, it, vi } from "vitest";
import { parseWarmupSecrets } from "../../workers/warmup/lib/config";
import { isAllowedWarmupFromAddress } from "../../workers/warmup/lib/from-address";
import { runWarmupCronTick } from "../../workers/warmup/lib/cron-tick";
import type { WarmupEnv } from "../../workers/warmup/lib/config";

describe("warmup WARMUP_FROM domain (unit)", () => {
  it("allows addresses on mail.we-met.link", () => {
    expect(isAllowedWarmupFromAddress("hello@mail.we-met.link")).toBe(true);
    expect(isAllowedWarmupFromAddress("HELLO@mail.we-met.link")).toBe(true);
  });

  it("rejects other domains", () => {
    expect(isAllowedWarmupFromAddress("from@example.com")).toBe(false);
  });

  it("parseWarmupSecrets returns null and logs when from is wrong domain", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const secrets = parseWarmupSecrets({
      WARMUP_SEEDS: "seed@example.com",
      WARMUP_FROM: "from@example.com",
    });
    expect(secrets).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "warmup_config_rejected",
      expect.objectContaining({ reason: "invalid_from" }),
    );
    warn.mockRestore();
  });

  it("cron sends nothing when WARMUP_FROM is not on mail.we-met.link", async () => {
    const send = vi.fn();
    const env: WarmupEnv = {
      WARMUP_SEEDS: "seed@example.com",
      WARMUP_FROM: "from@example.com",
      EMAIL: { send },
    };
    const result = await runWarmupCronTick(env, { unit: () => 0 });
    expect(result.action).toBe("skipped_missing_secrets");
    expect(send).not.toHaveBeenCalled();
  });
});
