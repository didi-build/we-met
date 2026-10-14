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

/** Build a RFC 5322 From header with optional display name (RFC 2047 when needed). */
export function formatEmailFromHeader(email: string, displayName?: string): string {
  const sanitizedEmail = sanitizeEmailHeaderValue(email);
  const trimmedName = displayName?.trim();
  if (!trimmedName) {
    return sanitizedEmail;
  }
  const sanitizedName = sanitizeEmailHeaderValue(trimmedName);
  const encodedName = isAsciiOnly(sanitizedName)
    ? `"${sanitizedName}"`
    : `"=?UTF-8?B?${base64EncodeUtf8(sanitizedName)}?="`;
  return `${encodedName} <${sanitizedEmail}>`;
}

/** Encode Subject per RFC 2047 when non-ASCII characters are present. */
export function encodeEmailSubject(subject: string): string {
  const sanitized = sanitizeEmailHeaderValue(subject);
  if (isAsciiOnly(sanitized)) {
    return sanitized;
  }
  return `=?UTF-8?B?${base64EncodeUtf8(sanitized)}?=`;
}
