import { normalizeVcardFormSlug } from "@/exchange/vcard-form-redirect";

export type ValidatedVCardTokenInput = {
  token: string;
  formSlug?: string;
};

export type VCardRequestReadResult =
  | { ok: true; value: ValidatedVCardTokenInput; isFormEncoded: boolean }
  | { ok: false; isFormEncoded: boolean; formSlug?: string };

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

function readFormSlug(params: URLSearchParams): string | undefined {
  const raw = params.get("slug");
  return raw === null ? undefined : normalizeVcardFormSlug(raw);
}

export async function readVCardRequestBody(
  request: Request,
): Promise<VCardRequestReadResult> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (mediaType === "application/json") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { ok: false, isFormEncoded: false };
    }
    const parsed = parseVCardTokenBody(body);
    if (!parsed.ok) {
      return { ok: false, isFormEncoded: false };
    }
    return { ok: true, value: parsed.value, isFormEncoded: false };
  }

  if (mediaType === "application/x-www-form-urlencoded") {
    let text: string;
    try {
      text = await request.text();
    } catch {
      return { ok: false, isFormEncoded: true };
    }
    const params = new URLSearchParams(text);
    const formSlug = readFormSlug(params);
    const token = params.get("token")?.trim() ?? "";
    if (!token || token.length > 4096) {
      return { ok: false, isFormEncoded: true, formSlug };
    }
    return {
      ok: true,
      value: { token, formSlug },
      isFormEncoded: true,
    };
  }

  return { ok: false, isFormEncoded: false };
}
