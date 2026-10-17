// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detailsSentStorageKey,
  readDetailsSentFlag,
  writeDetailsSentFlag,
} from "@/lib/hi-card/details-sent-storage";

describe("details-sent storage (unit)", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("uses a slug-scoped key with no personal data", () => {
    expect(detailsSentStorageKey("demo")).toBe("we-met-hi-details-sent:demo");
  });

  it("reads and writes the flag", () => {
    expect(readDetailsSentFlag("demo")).toBe(false);
    writeDetailsSentFlag("demo");
    expect(readDetailsSentFlag("demo")).toBe(true);
  });

  it("returns false when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readDetailsSentFlag("demo")).toBe(false);
  });
});
