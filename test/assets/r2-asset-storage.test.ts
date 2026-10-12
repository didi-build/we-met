import { describe, expect, it, vi } from "vitest";
import { createR2AssetStorage } from "@/assets/r2-asset-storage";

describe("createR2AssetStorage (unit)", () => {
  it("returns null when the object is missing", async () => {
    const bucket = {
      get: vi.fn(async () => null),
    };
    const storage = createR2AssetStorage(bucket as never);
    await expect(storage.getObject("missing")).resolves.toBeNull();
  });

  it("maps R2 object metadata", async () => {
    const body = new ReadableStream();
    const bucket = {
      get: vi.fn(async () => ({
        body,
        size: 10,
        httpMetadata: { contentType: "image/jpeg" },
      })),
    };
    const storage = createR2AssetStorage(bucket as never);
    const asset = await storage.getObject("cards/demo/x.jpg");
    expect(asset?.contentType).toBe("image/jpeg");
    expect(asset?.size).toBe(10);
    expect(asset?.body).toBe(body);
  });
});
