const LIMITS = {
  slug: 48,
  name: 200,
  email: 254,
  phone: 40,
  jobTitle: 200,
  company: 200,
  note: 2000,
  turnstileToken: 2048,
  website: 500,
} as const;

export type ValidatedExchangeInput = {
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  website: string;
  turnstileToken: string;
};

export type ValidatedDetailsInput = {
  token: string;
  jobTitle: string | null;
  company: string | null;
  note: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
  required: boolean,
): string | null {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    return required ? null : "";
  }
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (required && trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    return null;
  }
  return trimmed;
}

function readOptionalNullableString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null | undefined {
  const raw = body[key];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    return undefined;
  }
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  if (email.length > LIMITS.email) {
    return false;
  }
  return EMAIL_RE.test(email);
}

export function parseExchangeBody(
  body: unknown,
): { ok: true; value: ValidatedExchangeInput } | { ok: false } {
  if (!isPlainObject(body)) {
    return { ok: false };
  }

  const slug = readString(body, "slug", LIMITS.slug, true);
  const name = readString(body, "name", LIMITS.name, true);
  const emailRaw = readString(body, "email", LIMITS.email, true);
  const turnstileToken = readString(
    body,
    "turnstileToken",
    LIMITS.turnstileToken,
    true,
  );
  const website = readString(body, "website", LIMITS.website, false) ?? "";

  if (!slug || !name || !emailRaw || !turnstileToken) {
    return { ok: false };
  }
  if (!isValidEmail(emailRaw)) {
    return { ok: false };
  }

  const phoneRaw = readOptionalNullableString(body, "phone", LIMITS.phone);
  if (phoneRaw === undefined) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      slug,
      name,
      email: emailRaw.toLowerCase(),
      phone: phoneRaw,
      website,
      turnstileToken,
    },
  };
}

export function parseDetailsBody(
  body: unknown,
): { ok: true; value: ValidatedDetailsInput } | { ok: false } {
  if (!isPlainObject(body)) {
    return { ok: false };
  }

  const token = readString(body, "token", 4096, true);
  if (!token) {
    return { ok: false };
  }

  const jobTitle = readOptionalNullableString(body, "jobTitle", LIMITS.jobTitle);
  const company = readOptionalNullableString(body, "company", LIMITS.company);
  const note = readOptionalNullableString(body, "note", LIMITS.note);
  if (jobTitle === undefined || company === undefined || note === undefined) {
    return { ok: false };
  }

  return {
    ok: true,
    value: { token, jobTitle, company, note },
  };
}
