const CHUNK_SIZE = 64 * 1024;

export async function readBodyUpToMax(
  request: Request,
  maxBytes: number,
): Promise<
  { ok: true; bytes: Uint8Array } | { ok: false; reason: "too-large" | "empty" }
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

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: out };
}

export { CHUNK_SIZE };
