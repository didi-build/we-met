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

const viewportBounds = { left: 0, top: 0, width: 390, height: 844 };

describe("measureChipPopoverPosition", () => {
  it("opens below the chip when there is room (viewport fallback)", () => {
    const pos = measureChipPopoverPosition({
      chipRect: rect(100, 200, 80, 32),
      rootRect: rect(24, 100, 372, 400),
      popoverHeight: 120,
      bounds: viewportBounds,
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
      bounds: viewportBounds,
    });
    expect(pos.above).toBe(true);
    expect(pos.top).toBe(Math.round(700 - 10 - 120));
  });

  it("keeps the first chip popover inside a narrow preview boundary offset from the window", () => {
    const bounds = { left: 200, top: 80, width: 320, height: 500 };
    const pos = measureChipPopoverPosition({
      chipRect: rect(210, 300, 72, 28),
      rootRect: rect(200, 80, 320, 500),
      popoverHeight: 100,
      bounds,
    });
    expect(pos.left).toBeGreaterThanOrEqual(16);
    expect(pos.left + pos.w).toBeLessThanOrEqual(bounds.width - 16 + 0.5);
    expect(pos.w).toBe(Math.min(280, bounds.width - 32));
  });

  it("flips above within a boundary when it does not fit below", () => {
    const bounds = { left: 0, top: 0, width: 360, height: 200 };
    const pos = measureChipPopoverPosition({
      chipRect: rect(40, 150, 80, 32),
      rootRect: rect(0, 0, 360, 200),
      popoverHeight: 80,
      bounds,
    });
    expect(pos.above).toBe(true);
  });
});
