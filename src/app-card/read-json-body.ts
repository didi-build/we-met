export const MAX_CARD_JSON_BODY_BYTES = 64 * 1024;

export async function readJsonBodyWithCap(
  request: Request,
  maxBytes: number = MAX_CARD_JSON_BODY_BYTES,
): Promise<
  | { ok: true; json: unknown }
  | { ok: false; reason: "too-large" | "empty" | "invalid-json" }
> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      return { ok: false, reason: "too-large" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, reason: "empty" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too-large" };
    }
    chunks.push(value);
  }

  if (total === 0) {
    return { ok: false, reason: "empty" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);
  try {
    return { ok: true, json: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
}
