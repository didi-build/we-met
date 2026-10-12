import { describe, expect, it } from "vitest";
import { measureChipPopoverPosition } from "@/components/hi/hi-chip-popover-position";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } as DOMRect;
}

describe("measureChipPopoverPosition", () => {
  it("opens below the chip when there is room", () => {
    const pos = measureChipPopoverPosition({
      chipRect: rect(100, 200, 80, 32),
      rootRect: rect(24, 100, 372, 400),
      popoverHeight: 120,
      viewportWidth: 390,
      viewportHeight: 844,
    });
    expect(pos.above).toBe(false);
    expect(pos.w).toBe(280);
    expect(pos.top).toBe(Math.round(200 + 32 + 10 - 100));
  });

  it("opens above when below would overflow the viewport", () => {
    const pos = measureChipPopoverPosition({
      chipRect: rect(100, 700, 80, 32),
      rootRect: rect(0, 0, 390, 800),
      popoverHeight: 120,
      viewportWidth: 390,
      viewportHeight: 844,
    });
    expect(pos.above).toBe(true);
    expect(pos.top).toBe(Math.round(700 - 10 - 120));
  });
});
