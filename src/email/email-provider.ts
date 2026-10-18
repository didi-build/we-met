import { createCloudflareEmailSender } from "@/email/cloudflare-sender";
import { createGmailEmailSender } from "@/email/gmail-sender";
import { FollowupEmailError } from "@/email/followup-email-error";
import type { EmailSender, EmailSendResult, OutboundEmail } from "@/email/types";

export type EmailProvider = "gmail" | "cloudflare";

export type ConsumerEmailSenderEnv = {
  GMAIL_SERVICE_ACCOUNT_JSON: string;
  GMAIL_SENDER: string;
  EMAIL?: import("@/email/cloudflare-sender").CloudflareSendEmailBinding;
};

export type ConsumerOutboundEmailSend = (
  provider: EmailProvider,
  message: OutboundEmail,
) => Promise<EmailSendResult>;

export function createConsumerOutboundEmailSend(
  env: ConsumerEmailSenderEnv,
): ConsumerOutboundEmailSend {
  const gmailSender = createGmailEmailSender({
    serviceAccountJson: env.GMAIL_SERVICE_ACCOUNT_JSON,
    senderEmail: env.GMAIL_SENDER,
  });
  const cloudflareSender: EmailSender | null = env.EMAIL
    ? createCloudflareEmailSender(env.EMAIL)
    : null;

  return async (provider, message) => {
    if (provider === "cloudflare") {
      if (!cloudflareSender) {
        throw new FollowupEmailError("cloudflare_binding_missing");
      }
      return cloudflareSender.send(message);
    }
    return gmailSender.send(message);
  };
}
