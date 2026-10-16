import { CARD_PHOTO_JPEG_CONTENT_TYPE } from "@/assets/card-photo";
import { detectImageFormat } from "@/images/detect-image-format";
import { readBodyUpToMax } from "@/images/read-limited-body";
import { CARD_FIELD_LIMITS } from "@/card-data/limits";
import type { ImagesBinding, R2Bucket } from "@cloudflare/workers-types";

export type IngestCardPhotoError =
  | "too-large"
  | "unsupported-type"
  | "not-square"
  | "corrupt"
  | "images-unavailable"
  | "invalid-dimensions";

/** Square card photos must be within these bounds before resize to 512×512. */
export const CARD_PHOTO_MIN_SIDE = 128;
export const CARD_PHOTO_MAX_SIDE = 4096;

export type IngestCardPhotoResult =
  { ok: true; key: string; size: number } | { ok: false; error: IngestCardPhotoError };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type WorkerByteStream = Parameters<ImagesBinding["info"]>[0];

function toWorkerStream(bytes: Uint8Array): WorkerByteStream {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }) as WorkerByteStream;
}

function imageDimensions(
  info: Awaited<ReturnType<ImagesBinding["info"]>>,
): { width: number; height: number } | null {
  if ("width" in info && "height" in info && typeof info.width === "number") {
    return { width: info.width, height: info.height };
  }
  return null;
}

export async function ingestCardPhotoFromRequest(
  request: Request,
  bindings: { images?: ImagesBinding; assets: R2Bucket },
): Promise<IngestCardPhotoResult> {
  if (!bindings.images) {
    return { ok: false, error: "images-unavailable" };
  }

  const read = await readBodyUpToMax(request, CARD_FIELD_LIMITS.photoMaxBytes);
  if (!read.ok) {
    return { ok: false, error: read.reason === "too-large" ? "too-large" : "corrupt" };
  }

  const format = detectImageFormat(read.bytes);
  if (!format) {
    return { ok: false, error: "unsupported-type" };
  }

  let info: { width: number; height: number } | null;
  try {
    const meta = await bindings.images.info(toWorkerStream(read.bytes));
    info = imageDimensions(meta);
    if (!info) {
      return { ok: false, error: "corrupt" };
    }
  } catch {
    return { ok: false, error: "corrupt" };
  }

  if (info.width !== info.height) {
    return { ok: false, error: "not-square" };
  }

  if (
    info.width < CARD_PHOTO_MIN_SIDE ||
    info.height < CARD_PHOTO_MIN_SIDE ||
    info.width > CARD_PHOTO_MAX_SIDE ||
    info.height > CARD_PHOTO_MAX_SIDE
  ) {
    return { ok: false, error: "invalid-dimensions" };
  }

  let jpegBytes: Uint8Array;
  try {
    const transformed = await bindings.images
      .input(toWorkerStream(read.bytes))
      .transform({ width: 512, height: 512, fit: "cover" })
      .output({ format: "image/jpeg" });
    const chunks: Uint8Array[] = [];
    const outStream = transformed.image();
    const reader = outStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
    const size = chunks.reduce((n, c) => n + c.byteLength, 0);
    jpegBytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      jpegBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch {
    return { ok: false, error: "corrupt" };
  }

  const key = await sha256Hex(jpegBytes);
  const existing = await bindings.assets.head(key);
  if (!existing) {
    await bindings.assets.put(key, jpegBytes, {
      httpMetadata: { contentType: CARD_PHOTO_JPEG_CONTENT_TYPE },
    });
  }

  return { ok: true, key, size: jpegBytes.byteLength };
}
