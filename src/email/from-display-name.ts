import { FollowupEmailError } from "@/email/followup-email-error";

const FORBIDDEN_DISPLAY_NAME_CHARS = /[<>"\\]/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

const VISITOR_FIRST_WORD_MAX_LENGTH = 24;
const VISITOR_FIRST_NAME_CHARS = /^[\p{L}\p{M}'-]+$/u;

// Best-effort abuse mitigation; not a complete defense against misleading From names.
const VISITOR_FIRST_NAME_DENY_LIST = new Set(
  [
    "we met",
    "wemet",
    "google",
    "support",
    "admin",
    "security",
    "team",
    "help",
    "billing",
    "noreply",
    "no-reply",
    "service",
  ].map((entry) => entry.toLowerCase()),
);

function visitorFirstNameToken(given: string): string | null {
  const trimmed = given.trim();
  if (
    !trimmed ||
    CONTROL_CHARS.test(trimmed) ||
    FORBIDDEN_DISPLAY_NAME_CHARS.test(trimmed)
  ) {
    return null;
  }
  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  if (!firstWord) {
    return null;
  }
  if (
    firstWord.length > VISITOR_FIRST_WORD_MAX_LENGTH ||
    !VISITOR_FIRST_NAME_CHARS.test(firstWord) ||
    VISITOR_FIRST_NAME_DENY_LIST.has(firstWord.toLowerCase())
  ) {
    return null;
  }
  return firstWord;
}

/** Visitor follow-up From name: `{first} via We Met`, or platform name when the first name is unsafe. */
export function resolveVisitorFromDisplayName(
  given: string,
  platformDisplayName: string,
): string {
  const first = visitorFirstNameToken(given);
  if (!first) {
    return platformDisplayName;
  }
  return `${first} via We Met`;
}

export function resolveFromDisplayName(fromDisplayName: string | undefined): string {
  const trimmed = fromDisplayName?.trim();
  if (
    !trimmed ||
    trimmed.length > 80 ||
    CONTROL_CHARS.test(trimmed) ||
    FORBIDDEN_DISPLAY_NAME_CHARS.test(trimmed)
  ) {
    throw new FollowupEmailError("from_display_name_missing", {
      secretName: "WE_MET_FROM_DISPLAY_NAME",
    });
  }
  return trimmed;
}
