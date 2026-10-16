import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "@/app-auth/crypto";
import { consumeOAuthAttempt, createOAuthAttempt } from "@/app-auth/sessions";
import { withIsolatedLocalD1 } from "../helpers/d1";

describe("oauth attempts (D1 integration)", () => {
  it("consumes once and rejects expired attempts", async () => {
    await withIsolatedLocalD1(async (db) => {
      await createOAuthAttempt(db, {
        state: "state-a",
        nonce: "n1",
        pkceVerifier: "v1",
        mode: "redirect",
      });

      const first = await consumeOAuthAttempt(db, "state-a");
      expect(first.ok).toBe(true);
      const second = await consumeOAuthAttempt(db, "state-a");
      expect(second.ok).toBe(false);

      await createOAuthAttempt(db, {
        state: "state-b",
        nonce: "n2",
        pkceVerifier: "v2",
        mode: "popup",
      });
      await db
        .prepare("UPDATE oauth_attempts SET expires_at = ?")
        .bind("2000-01-01T00:00:00.000Z")
        .run();
      expect(await consumeOAuthAttempt(db, "state-b")).toEqual({ ok: false });
    });
  });

  it("allows only one winner when two consumes race", async () => {
    await withIsolatedLocalD1(async (db) => {
      await createOAuthAttempt(db, {
        state: "race-state",
        nonce: "n",
        pkceVerifier: "v",
        mode: "redirect",
      });
      const [a, b] = await Promise.all([
        consumeOAuthAttempt(db, "race-state"),
        consumeOAuthAttempt(db, "race-state"),
      ]);
      const wins = [a, b].filter((r) => r.ok);
      expect(wins).toHaveLength(1);
    });
  });

  it("compares oauth cookie state in constant time", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });
});
