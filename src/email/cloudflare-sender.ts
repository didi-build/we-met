import { FollowupEmailError } from "@/email/followup-email-error";
import { sanitizeRfc5322MessageId } from "@/email/mime-headers";
import type {
  EmailAttachment,
  EmailSender,
  EmailSendResult,
  OutboundEmail,
} from "@/email/types";

export type CloudflareSendEmailBinding = {
  send(message: CloudflareOutboundMessage): Promise<{ messageId: string }>;
};

export type CloudflareOutboundMessage = {
  from: { email: string; name?: string };
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: "attachment" | "inline";
  }>;
};

function base64EncodeUtf8(value: string): string {
  const base64 = btoa(
    Array.from(new TextEncoder().encode(value), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
  return base64;
}

type CloudflareAttachment = NonNullable<
  CloudflareOutboundMessage["attachments"]
>[number];

function mapAttachment(attachment: EmailAttachment): CloudflareAttachment {
  return {
    content: base64EncodeUtf8(attachment.body),
    filename: attachment.filename,
    type: attachment.mimeType,
    disposition: "attachment",
  };
}

function cloudflareErrorFromThrown(error: unknown): FollowupEmailError {
  if (error instanceof FollowupEmailError) {
    return error;
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    return new FollowupEmailError(`cloudflare_${code}`);
  }
  return new FollowupEmailError("unknown");
}

export function createCloudflareEmailSender(
  binding: CloudflareSendEmailBinding,
): EmailSender {
  return {
    async send(message: OutboundEmail): Promise<EmailSendResult> {
      const headers: Record<string, string> = {};
      if (message.inReplyTo && message.references) {
        headers["In-Reply-To"] = sanitizeRfc5322MessageId(message.inReplyTo);
        headers["References"] = sanitizeRfc5322MessageId(message.references);
      }

      const payload: CloudflareOutboundMessage = {
        from: {
          email: message.from,
          ...(message.fromDisplayName?.trim()
            ? { name: message.fromDisplayName.trim() }
            : {}),
        },
        to: message.to,
        subject: message.subject,
        text: message.textPlain,
        html: message.textHtml,
        ...(message.replyTo?.trim() ? { replyTo: message.replyTo.trim() } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(message.attachments && message.attachments.length > 0
          ? { attachments: message.attachments.map(mapAttachment) }
          : {}),
      };

      try {
        const result = await binding.send(payload);
        return { messageId: result.messageId, threadId: null };
      } catch (error) {
        throw cloudflareErrorFromThrown(error);
      }
    },
  };
}
