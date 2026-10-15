import { CARD_FIELD_LIMITS } from "@/card-data/limits";

export type SlugUiStatus =
  | { status: "empty" }
  | { status: "typing"; value: string }
  | { status: "checking"; value: string }
  | { status: "available"; value: string }
  | { status: "mine"; value: string }
  | { status: "taken"; value: string }
  | { status: "reserved"; value: string }
  | { status: "invalid"; value: string; message: string }
  | { status: "unknown"; value: string };

export function slugFormatCheck(value: string): string {
  if (!value) {
    return "";
  }
  if (/[^a-z0-9-]/.test(value)) {
    return "Use only lowercase letters, numbers and hyphens.";
  }
  if (value.length < CARD_FIELD_LIMITS.slugMin) {
    return `Use at least ${CARD_FIELD_LIMITS.slugMin} characters.`;
  }
  if (value.length > CARD_FIELD_LIMITS.slugMax) {
    return `Keep it to ${CARD_FIELD_LIMITS.slugMax} characters or fewer.`;
  }
  if (/^-|-$/.test(value)) {
    return "It can't start or end with a hyphen.";
  }
  if (/--/.test(value)) {
    return "Use one hyphen at a time.";
  }
  return "";
}
