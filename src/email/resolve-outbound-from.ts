import type { EmailProvider } from "@/email/email-provider";
import { resolveCloudflareFromEmail } from "@/email/cloudflare-from";
import { resolveOwnerFromEmail } from "@/email/owner-from";

export type OutboundFromSecrets = {
  ownerFromEmail?: string;
  cloudflareFromEmail?: string;
};

export function resolveOutboundFromEmail(
  provider: EmailProvider,
  secrets: OutboundFromSecrets,
): string {
  if (provider === "cloudflare") {
    return resolveCloudflareFromEmail(secrets.cloudflareFromEmail);
  }
  return resolveOwnerFromEmail(secrets.ownerFromEmail);
}
