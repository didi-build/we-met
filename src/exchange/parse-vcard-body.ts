export type ValidatedVCardTokenInput = {
  token: string;
};

function readTokenString(body: Record<string, unknown>): string | null {
  const raw = body.token;
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 4096) {
    return null;
  }
  return trimmed;
}

export function parseVCardTokenBody(
  body: unknown,
): { ok: true; value: ValidatedVCardTokenInput } | { ok: false } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false };
  }
  const token = readTokenString(body as Record<string, unknown>);
  if (!token) {
    return { ok: false };
  }
  return { ok: true, value: { token } };
}

export async function readVCardRequestBody(
  request: Request,
): Promise<{ ok: true; value: ValidatedVCardTokenInput } | { ok: false }> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (mediaType === "application/json") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { ok: false };
    }
    return parseVCardTokenBody(body);
  }

  if (mediaType === "application/x-www-form-urlencoded") {
    let text: string;
    try {
      text = await request.text();
    } catch {
      return { ok: false };
    }
    const params = new URLSearchParams(text);
    const token = params.get("token")?.trim() ?? "";
    if (!token || token.length > 4096) {
      return { ok: false };
    }
    return { ok: true, value: { token } };
  }

  return { ok: false };
}
