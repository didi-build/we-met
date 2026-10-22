import { describe, expect, it, vi } from "vitest";
import { guardDlqSend, sendToDlqIfAllowed } from "../../workers/warmup/lib/dlq";

describe("warmup DLQ guard (unit)", () => {
  it("refuses DLQ send when binding is missing", () => {
    expect(
      guardDlqSend(
        {},
        {
          reason: "send_failed",
          toRedacted: "a***@example.com",
          at: "2026-01-01T00:00:00.000Z",
        },
      ),
    ).toEqual({ ok: false, reason: "missing_binding" });
  });

  it("refuses DLQ send when body is invalid", () => {
    expect(
      guardDlqSend(
        { WARMUP_DLQ: { send: vi.fn() } as never },
        { reason: "", toRedacted: "x", at: "t" },
      ),
    ).toEqual({ ok: false, reason: "invalid_body" });
  });

  it("sends to DLQ when guard passes", async () => {
    const send = vi.fn(async () => ({ id: "dlq-1", metadata: null }));
    const result = await sendToDlqIfAllowed(
      { WARMUP_DLQ: { send } as never },
      {
        reason: "not_in_seeds",
        toRedacted: "b***@example.com",
        at: "2026-01-01T00:00:00.000Z",
      },
    );
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
  });
});
