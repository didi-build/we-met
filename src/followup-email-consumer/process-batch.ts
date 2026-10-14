import { buildVisitorFollowUpEmail } from "@/email/format-visitor-follow-up";
import { createGmailEmailSender } from "@/email/gmail-sender";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import { resolveEmailRecipient } from "@/email/recipient";
import type { EmailSender } from "@/email/types";
import {
  buildOwnerVCardAttachment,
  type ReadOnlyR2Assets,
} from "@/followup-email-consumer/load-vcard-photo";
import {
  followupEmailRetryDelaySeconds,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "@/followup-email-consumer/retry";
import {
  isUnsupportedQueueMessageType,
  parseVisitorFollowupMessage,
  queueMessageTypeLabel,
} from "@/followup-email-consumer/validate";

export class UnsupportedQueueMessageError extends Error {
  readonly typeLabel: string;

  constructor(typeLabel: string) {
    super(`unsupported_queue_message_type:${typeLabel}`);
    this.name = "UnsupportedQueueMessageError";
    this.typeLabel = typeLabel;
  }
}

export type FollowupQueueMessage = {
  readonly id: string;
  readonly attempts: number;
  readonly body: unknown;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

export type FollowupQueueBatch = {
  readonly messages: readonly FollowupQueueMessage[];
};

export type FollowupConsumerEnv = {
  WE_MET_ENV: string;
  WE_MET_BASE_URL: string;
  GMAIL_SENDER: string;
  GMAIL_SERVICE_ACCOUNT_JSON: string;
  WE_MET_TEST_MAIL_TO?: string;
  WE_MET_ASSETS: ReadOnlyR2Assets;
};

export type FollowupConsumerDeps = {
  weMetEnv: string;
  baseUrl: string;
  gmailSender: string;
  testMailTo?: string;
  emailSender: EmailSender;
  assets: ReadOnlyR2Assets;
  logVisitorFollowupPermanentFailure(leadId: string, errorType: string): void;
  logMalformedVisitorFollowup(leadId: string | null): void;
  logUnsupportedType(typeLabel: string): void;
  logMissingPhoto(key: string): void;
  logNonJpegPhoto(key: string): void;
};

export function createFollowupConsumerDepsFromEnv(
  env: FollowupConsumerEnv,
): FollowupConsumerDeps {
  return {
    weMetEnv: env.WE_MET_ENV,
    baseUrl: env.WE_MET_BASE_URL,
    gmailSender: env.GMAIL_SENDER,
    testMailTo: env.WE_MET_TEST_MAIL_TO,
    emailSender: createGmailEmailSender({
      serviceAccountJson: env.GMAIL_SERVICE_ACCOUNT_JSON,
      senderEmail: env.GMAIL_SENDER,
    }),
    assets: env.WE_MET_ASSETS,
    logVisitorFollowupPermanentFailure(leadId, errorType) {
      console.error("visitor_followup_permanent_failure", { leadId, errorType });
    },
    logMalformedVisitorFollowup(leadId) {
      console.error("visitor_followup_malformed", { leadId });
    },
    logUnsupportedType(typeLabel) {
      console.error("followup_unsupported_queue_type", { typeLabel });
    },
    logMissingPhoto(key) {
      console.error("followup_vcard_photo_missing", { photoKey: key });
    },
    logNonJpegPhoto(key) {
      console.error("followup_vcard_photo_not_jpeg", { photoKey: key });
    },
  };
}

async function sendVisitorFollowup(
  message: NonNullable<ReturnType<typeof parseVisitorFollowupMessage>>,
  deps: FollowupConsumerDeps,
): Promise<void> {
  const recipient = resolveEmailRecipient({
    weMetEnv: deps.weMetEnv,
    visitorEmail: message.lead.email,
    testMailTo: deps.testMailTo,
  });

  const nonProdLabel =
    recipient.mode === "nonprod" ? recipient.visitorEmailForContent : undefined;

  const content = buildVisitorFollowUpEmail({
    card: message.card,
    visitorName: message.lead.name,
    visitorEmail: message.lead.email,
    baseUrl: deps.baseUrl,
    nonProdVisitorEmailLabel: nonProdLabel,
  });

  const { vcardBody, filename } = await buildOwnerVCardAttachment(
    message.card.contact,
    message.card.photoKey,
    deps.assets,
    deps,
  );

  await deps.emailSender.send({
    from: deps.gmailSender,
    fromDisplayName: message.card.pageCopy.emailFromName,
    to: recipient.to,
    replyTo: sanitizeEmailHeaderValue(message.card.email),
    subject: content.subject,
    textPlain: content.textPlain,
    textHtml: content.textHtml,
    attachments: [
      {
        filename,
        mimeType: "text/vcard",
        body: vcardBody,
      },
    ],
  });
}

async function processQueueMessage(
  message: FollowupQueueMessage,
  deps: FollowupConsumerDeps,
): Promise<void> {
  if (isUnsupportedQueueMessageType(message.body)) {
    const typeLabel = queueMessageTypeLabel(message.body);
    deps.logUnsupportedType(typeLabel);
    throw new UnsupportedQueueMessageError(typeLabel);
  }

  const parsed = parseVisitorFollowupMessage(message.body);
  if (!parsed) {
    const leadId =
      typeof message.body === "object" &&
      message.body &&
      "lead" in message.body &&
      typeof (message.body as { lead?: { leadId?: string } }).lead?.leadId === "string"
        ? (message.body as { lead: { leadId: string } }).lead.leadId
        : null;
    deps.logMalformedVisitorFollowup(leadId);
    message.ack();
    return;
  }

  try {
    await sendVisitorFollowup(parsed, deps);
    message.ack();
  } catch (error) {
    const errorType = error instanceof Error ? error.name || error.message : "unknown";
    if (message.attempts >= MAX_VISITOR_FOLLOWUP_ATTEMPTS) {
      deps.logVisitorFollowupPermanentFailure(parsed.lead.leadId, errorType);
      message.ack();
      return;
    }
    message.retry({ delaySeconds: followupEmailRetryDelaySeconds(message.attempts) });
  }
}

export async function processFollowupQueueBatch(
  batch: FollowupQueueBatch,
  deps: FollowupConsumerDeps,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processQueueMessage(message, deps);
    } catch (error) {
      if (error instanceof UnsupportedQueueMessageError) {
        message.retry({
          delaySeconds: followupEmailRetryDelaySeconds(message.attempts),
        });
        continue;
      }
      throw error;
    }
  }
}
