import { resolveCloudflareFromEmail } from "@/email/cloudflare-from";

export type OutboundFromSecrets = {
  cloudflareFromEmail?: string;
};

export function resolveOutboundFromEmail(secrets: OutboundFromSecrets): string {
  return resolveCloudflareFromEmail(secrets.cloudflareFromEmail);
}
