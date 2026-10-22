import { describe, expect, it } from "vitest";
import {
  checkWarmupSendGate,
  WARMUP_INVALID_PAUSED_STATE,
  WARMUP_KV_PAUSED,
} from "../../workers/warmup/lib/state";
import type { WarmupEnv } from "../../workers/warmup/lib/config";
import { createMemoryKv, warmupKvEnabled } from "./memory-kv";
import { readWarmupEnabled } from "../../workers/warmup/lib/state";

describe("warmup KV state (unit)", () => {
  it("treats a missing enabled key as off", async () => {
    const kv = createMemoryKv();
    expect(await readWarmupEnabled(kv)).toBe(false);
  });

  it("treats malformed paused JSON as paused (fail closed)", async () => {
    const kv = warmupKvEnabled();
    await kv.put(WARMUP_KV_PAUSED, '{"oops":true}');

    const env: WarmupEnv = { WARMUP_STATE: kv };
    const gate = await checkWarmupSendGate(env);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.reason).toBe("paused");
      expect(gate.paused?.reason).toBe(WARMUP_INVALID_PAUSED_STATE.reason);
    }
  });
});
