import { detectImageFormat } from "@/images/detect-image-format";
import { describe, expect, it } from "vitest";

describe("detectImageFormat (unit)", () => {
  it("detects jpeg, png, and webp magic bytes", () => {
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("jpeg");
    expect(
      detectImageFormat(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
    expect(
      detectImageFormat(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
    ).toBe("webp");
    expect(detectImageFormat(new Uint8Array([0x00]))).toBeNull();
  });
});
