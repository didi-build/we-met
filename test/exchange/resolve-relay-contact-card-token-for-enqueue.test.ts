import { describe, expect, it, vi } from "vitest";
import type { VisitorEmailMode } from "@/app-settings/defaults";
import * as relayContactCardToken from "@/exchange/relay-contact-card-token";
import { resolveRelayContactCardTokenForEnqueue } from "@/exchange/resolve-relay-contact-card-token-for-enqueue";

describe("resolveRelayContactCardTokenForEnqueue (unit)", () => {
  it("resolves to direct and mints no token when mode read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = await resolveRelayContactCardTokenForEnqueue(
      "test-secret",
      async () => {
        throw new Error("d1 unavailable");
      },
      "lead-mode-fail",
      "card-1",
    );
    expect(token).toBeUndefined();
    const modeLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "visitor_email_mode_read_failed",
    );
    expect(modeLogs).toHaveLength(1);
    expect(modeLogs[0]?.[1]).toEqual({ leadId: "lead-mode-fail" });
    errorSpy.mockRestore();
  });

  it("logs relay_contact_card_token_failed with leadId only when mint throws in owner_relay", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(
      relayContactCardToken,
      "relayContactCardTokenForEnqueue",
    ).mockImplementation(() => {
      throw new Error("mint failed");
    });
    const token = await resolveRelayContactCardTokenForEnqueue(
      "test-secret",
      async (): Promise<VisitorEmailMode> => "owner_relay",
      "lead-mint-fail",
      "card-1",
    );
    expect(token).toBeUndefined();
    const mintLogs = errorSpy.mock.calls.filter(
      (call) => call[0] === "relay_contact_card_token_failed",
    );
    expect(mintLogs).toHaveLength(1);
    expect(mintLogs[0]?.[1]).toEqual({ leadId: "lead-mint-fail" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("test-secret");
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });
});
