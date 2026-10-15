// @vitest-environment jsdom

import { captureSheetOpener, restoreSheetFocus } from "@/lib/hi-card/sheet-focus";
import { describe, expect, it, vi } from "vitest";

describe("sheet-focus", () => {
  it("restoreSheetFocus focuses opener with preventScroll when connected", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    const focus = vi.fn();
    opener.focus = focus;

    const result = restoreSheetFocus(opener, null);
    expect(result).toBe(opener);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("restoreSheetFocus uses fallback when opener is disconnected", () => {
    const opener = document.createElement("button");
    const fallback = document.createElement("button");
    document.body.appendChild(fallback);
    const focus = vi.fn();
    fallback.focus = focus;

    const result = restoreSheetFocus(opener, fallback);
    expect(result).toBe(fallback);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("captureSheetOpener returns the event target element", () => {
    const button = document.createElement("button");
    expect(captureSheetOpener(button)).toBe(button);
  });
});
