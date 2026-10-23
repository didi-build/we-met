import { createCloudflareEmailSender } from "@/email/cloudflare-sender";
import { FollowupEmailError } from "@/email/followup-email-error";
import type { EmailSender, EmailSendResult, OutboundEmail } from "@/email/types";

export type ConsumerEmailSenderEnv = {
  EMAIL?: import("@/email/cloudflare-sender").CloudflareSendEmailBinding;
};

export type ConsumerOutboundEmailSend = (
  message: OutboundEmail,
) => Promise<EmailSendResult>;

export function createConsumerOutboundEmailSend(
  env: ConsumerEmailSenderEnv,
): ConsumerOutboundEmailSend {
  const cloudflareSender: EmailSender | null = env.EMAIL
    ? createCloudflareEmailSender(env.EMAIL)
    : null;

  return async (message) => {
    if (!cloudflareSender) {
      throw new FollowupEmailError("cloudflare_binding_missing");
    }
    return cloudflareSender.send(message);
  };
}
