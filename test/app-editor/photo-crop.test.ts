import { describe, expect, it } from "vitest";
import {
  clampCrop,
  cropBaseScale,
  cropSourceRect,
  CROP_OUTPUT_SIZE,
} from "@/lib/app-editor/photo-crop";

describe("photo-crop (unit)", () => {
  it("computes base scale to cover the stage", () => {
    expect(cropBaseScale(320, 800, 600)).toBeCloseTo(320 / 600);
  });

  it("clamps pan inside image bounds", () => {
    const crop = clampCrop({
      x: 500,
      y: -500,
      z: 1,
      base: 1,
      w: 400,
      h: 400,
      S: 320,
    });
    expect(crop.x).toBeLessThan(500);
    expect(crop.y).toBeGreaterThan(-500);
  });

  it("derives a square source rect in image pixels", () => {
    const { sx, sy, sSize } = cropSourceRect({
      x: 0,
      y: 0,
      z: 2,
      base: 1,
      w: 400,
      h: 400,
      S: 320,
    });
    expect(sSize).toBeGreaterThan(0);
    expect(sx).toBeGreaterThanOrEqual(0);
    expect(sy).toBeGreaterThanOrEqual(0);
    expect(CROP_OUTPUT_SIZE).toBe(512);
  });
});
