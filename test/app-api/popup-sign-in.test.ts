// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { waitForPopupSignIn } from "@/app-api/popup-sign-in";

describe("waitForPopupSignIn (unit)", () => {
  it("resolves canceled from postMessage", async () => {
    const popup = { closed: false } as Window;
    const readSession = vi.fn().mockResolvedValue(null);
    const promise = waitForPopupSignIn(popup, readSession, {
      timeoutMs: 2000,
      pollIntervalMs: 100,
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "we-met-auth", result: "canceled" },
        origin: window.location.origin,
      }),
    );
    await expect(promise).resolves.toBe("canceled");
  });

  it("resolves ok when postMessage ok and session is present", async () => {
    const popup = { closed: false } as Window;
    const readSession = vi.fn().mockResolvedValue({
      email: "a@b.com",
      name: "A",
      allowed: true,
    });
    const promise = waitForPopupSignIn(popup, readSession, {
      timeoutMs: 2000,
      pollIntervalMs: 100,
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "we-met-auth", result: "ok" },
        origin: window.location.origin,
      }),
    );
    await expect(promise).resolves.toBe("ok");
  });

  it("times out as closed when popup never completes", async () => {
    const popup = { closed: false } as Window;
    const readSession = vi.fn().mockResolvedValue(null);
    await expect(
      waitForPopupSignIn(popup, readSession, { timeoutMs: 30, pollIntervalMs: 10 }),
    ).resolves.toBe("closed");
  });
});
