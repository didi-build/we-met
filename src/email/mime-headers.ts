import { FollowupEmailError } from "@/email/followup-email-error";

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/g;

function isAsciiOnly(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) {
      return false;
    }
  }
  return true;
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Strip control characters and collapse whitespace for MIME header values. */
export function sanitizeEmailHeaderValue(value: string): string {
  const withoutControls = value.replace(CONTROL_CHAR_PATTERN, " ");
  return withoutControls.replace(/\s+/g, " ").trim();
}

function escapeQuotedDisplayName(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const RFC2047_ENCODED_WORD_MAX = 75;
const RFC2047_UTF8_B64_PREFIX = "=?UTF-8?B?";
const RFC2047_UTF8_B64_SUFFIX = "?=";
const RFC2047_UTF8_B64_MAX =
  RFC2047_ENCODED_WORD_MAX -
  RFC2047_UTF8_B64_PREFIX.length -
  RFC2047_UTF8_B64_SUFFIX.length;

function iterateUnicodeScalars(value: string): string[] {
  const scalars: string[] = [];
  for (let i = 0; i < value.length;) {
    const codePoint = value.codePointAt(i)!;
    scalars.push(String.fromCodePoint(codePoint));
    i += codePoint > 0xffff ? 2 : 1;
  }
  return scalars;
}

/** RFC 2047 encoded-words for a UTF-8 display name (no surrounding quotes). */
function encodeRfc2047Utf8DisplayName(value: string): string {
  const words: string[] = [];
  let current = "";
  for (const scalar of iterateUnicodeScalars(value)) {
    const trial = current + scalar;
    const trialB64 = base64EncodeUtf8(trial);
    if (trialB64.length > RFC2047_UTF8_B64_MAX) {
      if (current.length === 0) {
        words.push(`${RFC2047_UTF8_B64_PREFIX}${trialB64}${RFC2047_UTF8_B64_SUFFIX}`);
        current = "";
        continue;
      }
      words.push(
        `${RFC2047_UTF8_B64_PREFIX}${base64EncodeUtf8(current)}${RFC2047_UTF8_B64_SUFFIX}`,
      );
      current = scalar;
      continue;
    }
    current = trial;
  }
  if (current.length > 0) {
    words.push(
      `${RFC2047_UTF8_B64_PREFIX}${base64EncodeUtf8(current)}${RFC2047_UTF8_B64_SUFFIX}`,
    );
  }
  return words.join(" ");
}

/** Build a RFC 5322 From header with optional display name (RFC 2047 when needed). */
export function formatEmailFromHeader(email: string, displayName?: string): string {
  const sanitizedEmail = sanitizeEmailHeaderValue(email);
  const trimmedName = displayName?.trim();
  if (!trimmedName) {
    return sanitizedEmail;
  }
  const sanitizedName = sanitizeEmailHeaderValue(trimmedName);
  const encodedName = isAsciiOnly(sanitizedName)
    ? `"${escapeQuotedDisplayName(sanitizedName)}"`
    : encodeRfc2047Utf8DisplayName(sanitizedName);
  return `${encodedName} <${sanitizedEmail}>`;
}

const RFC5322_MESSAGE_ID = /^<[^<>\s\u0000-\u001f\u007f]+>$/;

/** Validate a Message-ID / In-Reply-To / References token. */
export function sanitizeRfc5322MessageId(value: string): string {
  const trimmed = value.trim();
  if (!RFC5322_MESSAGE_ID.test(trimmed)) {
    throw new FollowupEmailError("invalid_rfc5322_message_id");
  }
  return trimmed;
}

/** Encode Subject per RFC 2047 when non-ASCII characters are present. */
export function encodeEmailSubject(subject: string): string {
  const sanitized = sanitizeEmailHeaderValue(subject);
  if (isAsciiOnly(sanitized)) {
    return sanitized;
  }
  return `=?UTF-8?B?${base64EncodeUtf8(sanitized)}?=`;
}
