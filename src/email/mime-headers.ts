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
    : `"=?UTF-8?B?${base64EncodeUtf8(sanitizedName)}?="`;
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
