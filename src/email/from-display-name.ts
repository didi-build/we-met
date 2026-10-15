import { FollowupEmailError } from "@/email/followup-email-error";

const FORBIDDEN_DISPLAY_NAME_CHARS = /[<>"\\]/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

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
