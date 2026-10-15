import { FollowupEmailError } from "@/email/followup-email-error";
import { isPlainSingleEmailAddress } from "@/email/plain-email";

export function resolveOwnerFromEmail(ownerFromEmail: string | undefined): string {
  const trimmed = ownerFromEmail?.trim();
  if (!trimmed || !isPlainSingleEmailAddress(trimmed)) {
    throw new FollowupEmailError("owner_from_email_missing", {
      secretName: "WE_MET_OWNER_FROM_EMAIL",
    });
  }
  return trimmed;
}
