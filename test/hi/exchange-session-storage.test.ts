// @vitest-environment jsdom

import {
  clearExchangeSession,
  exchangeCompletedStorageKey,
  exchangeSessionStorageKey,
  readExchangeSession,
  writeExchangeCompletedFlag,
  writeExchangeSession,
} from "@/lib/hi-card/exchange-session-storage";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("exchange session storage (unit)", () => {
  it("stores token and owner contact in one sessionStorage JSON entry", () => {
    const slug = "one-key-slug";
    writeExchangeSession(slug, {
      firstName: "Sam",
      visitorEmail: "sam@example.com",
      leadToken: "signed.token",
      ownerEmail: "owner@example.com",
      ownerPhone: "+1 555 0100",
    });

    const key = exchangeSessionStorageKey(slug);
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem(key)).toContain("owner@example.com");
    expect(window.sessionStorage.getItem(key)).toContain("+1 555 0100");
    expect(readExchangeSession(slug)).toEqual({
      firstName: "Sam",
      visitorEmail: "sam@example.com",
      leadToken: "signed.token",
      ownerEmail: "owner@example.com",
      ownerPhone: "+1 555 0100",
    });

    clearExchangeSession(slug);
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it("does not write owner contact into localStorage when persisting exchange completed", () => {
    const slug = "completed-flag-slug";
    writeExchangeCompletedFlag(slug);
    expect(window.localStorage.getItem(exchangeCompletedStorageKey(slug))).toBe("1");
    expect(window.localStorage.getItem(exchangeSessionStorageKey(slug))).toBeNull();
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const value = window.localStorage.key(i)
        ? window.localStorage.getItem(window.localStorage.key(i)!)
        : "";
      expect(value).not.toContain("owner@example.com");
      expect(value).not.toContain("+1 555");
    }
  });
});
