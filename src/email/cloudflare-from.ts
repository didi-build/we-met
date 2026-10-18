import { FollowupEmailError } from "@/email/followup-email-error";
import { isPlainSingleEmailAddress } from "@/email/plain-email";

export function resolveCloudflareFromEmail(
  cloudflareFromEmail: string | undefined,
): string {
  const trimmed = cloudflareFromEmail?.trim();
  if (!trimmed || !isPlainSingleEmailAddress(trimmed)) {
    throw new FollowupEmailError("cloudflare_from_email_missing", {
      secretName: "WE_MET_EMAIL_FROM_CLOUDFLARE",
    });
  }
  return trimmed;
}
