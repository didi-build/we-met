import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { CARD_FIELD_LIMITS } from "@/card-data/limits";
import {
  CARD_PHOTO_MAX_SIDE,
  CARD_PHOTO_MIN_SIDE,
  ingestCardPhotoFromRequest,
} from "@/images/ingest-card-photo";
import type { ImagesBinding, R2Bucket } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vitest";

const JPEG_MAGIC = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

function squareJpegRequest(bytes: Uint8Array, contentLength?: number): Request {
  const headers: Record<string, string> = {
    "content-type": "image/jpeg",
  };
  if (contentLength !== undefined) {
    headers["content-length"] = String(contentLength);
  }
  return new Request("https://localhost/api/app/photo", {
    method: "POST",
    headers,
    body: new Blob([new Uint8Array(bytes)]),
  });
}

function createFakeImagesBinding(options: {
  width: number;
  height: number;
  outputBytes?: Uint8Array;
  infoThrows?: boolean;
}): ImagesBinding {
  const outputBytes = options.outputBytes ?? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return {
    info: vi.fn(async () => {
      if (options.infoThrows) {
        throw new Error("corrupt");
      }
      return { width: options.width, height: options.height };
    }),
    input: vi.fn(() => ({
      transform: vi.fn(() => ({
        output: vi.fn(() => ({
          image: () =>
            new ReadableStream({
              start(controller) {
                controller.enqueue(outputBytes);
                controller.close();
              },
            }),
        })),
      })),
    })),
  } as unknown as ImagesBinding;
}

describe("ingestCardPhotoFromRequest (unit)", () => {
  it("rejects oversize bodies before reading the full stream", async () => {
    const request = squareJpegRequest(
      new Uint8Array(10),
      CARD_FIELD_LIMITS.photoMaxBytes + 1,
    );
    const assets = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    const result = await ingestCardPhotoFromRequest(request, {
      images: createFakeImagesBinding({ width: 512, height: 512 }),
      assets,
    });
    expect(result).toEqual({ ok: false, error: "too-large" });
    expect(assets.put).not.toHaveBeenCalled();
  });

  it("rejects unsupported type", async () => {
    const request = new Request("https://localhost/api/app/photo", {
      method: "POST",
      body: new Uint8Array([0x00, 0x01, 0x02]),
    });
    const assets = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    const result = await ingestCardPhotoFromRequest(request, {
      images: createFakeImagesBinding({ width: 512, height: 512 }),
      assets,
    });
    expect(result).toEqual({ ok: false, error: "unsupported-type" });
  });

  it("rejects non-square images", async () => {
    const assets = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    const result = await ingestCardPhotoFromRequest(squareJpegRequest(JPEG_MAGIC), {
      images: createFakeImagesBinding({ width: 512, height: 513 }),
      assets,
    });
    expect(result).toEqual({ ok: false, error: "not-square" });
  });

  it("rejects out-of-range dimensions before transform", async () => {
    const assets = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    const tooSmall = await ingestCardPhotoFromRequest(squareJpegRequest(JPEG_MAGIC), {
      images: createFakeImagesBinding({
        width: CARD_PHOTO_MIN_SIDE - 1,
        height: CARD_PHOTO_MIN_SIDE - 1,
      }),
      assets,
    });
    expect(tooSmall).toEqual({ ok: false, error: "invalid-dimensions" });

    const tooLarge = await ingestCardPhotoFromRequest(squareJpegRequest(JPEG_MAGIC), {
      images: createFakeImagesBinding({
        width: CARD_PHOTO_MAX_SIDE + 1,
        height: CARD_PHOTO_MAX_SIDE + 1,
      }),
      assets,
    });
    expect(tooLarge).toEqual({ ok: false, error: "invalid-dimensions" });
  });

  it("rejects corrupt metadata", async () => {
    const assets = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    const result = await ingestCardPhotoFromRequest(squareJpegRequest(JPEG_MAGIC), {
      images: createFakeImagesBinding({ width: 512, height: 512, infoThrows: true }),
      assets,
    });
    expect(result).toEqual({ ok: false, error: "corrupt" });
  });

  it("writes a 512×512 JPEG to R2 and reuses the content hash key", async () => {
    const jpegOut = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    const put = vi.fn(async () => undefined);
    const head = vi.fn(async () => null);
    const assets = { put, head } as unknown as R2Bucket;
    const images = createFakeImagesBinding({
      width: 512,
      height: 512,
      outputBytes: jpegOut,
    });

    const first = await ingestCardPhotoFromRequest(squareJpegRequest(JPEG_MAGIC), {
      images,
      assets,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      first.ok ? first.key : "",
      expect.any(Uint8Array),
      {
        httpMetadata: { contentType: CARD_PHOTO_JPEG_CONTENT_TYPE },
      },
    );

    head.mockResolvedValueOnce({} as never);
    const second = await ingestCardPhotoFromRequest(squareJpegRequest(JPEG_MAGIC), {
      images,
      assets,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.key).toBe(first.key);
    }
    expect(put).toHaveBeenCalledTimes(1);
  });
});

describe("R2 card photo writes (unit)", () => {
  it("only ingest-card-photo calls assets.put in src/images", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "src/images");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(join(dir, file), "utf8");
      if (src.includes(".put(") && file !== "ingest-card-photo.ts") {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
