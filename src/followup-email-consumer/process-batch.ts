import { buildVisitorFollowUpEmail } from "@/email/format-visitor-follow-up";
import {
  followupEmailErrorLogFields,
  type FollowupEmailErrorLogFields,
} from "@/email/followup-email-error";
import { createGmailEmailSender } from "@/email/gmail-sender";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import { resolveEmailRecipient } from "@/email/recipient";
import type { EmailSender } from "@/email/types";
import {
  buildOwnerVCardAttachment,
  type ReadOnlyR2Assets,
} from "@/followup-email-consumer/load-vcard-photo";
import { createReadOnlyConsumerAssets } from "@/followup-email-consumer/r2-assets";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  followupEmailRetryDelaySeconds,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "@/followup-email-consumer/retry";
import { createConsumerLeadDeliveryLedger } from "@/followup-email-consumer/lead-delivery-ledger";
import { createEmailLeadSinkHandler } from "@/followup-email-consumer/lead-sink/email-handler";
import { createLeadSinkHandlerRegistry } from "@/followup-email-consumer/lead-sink/registry";
import { processLeadSinkQueueMessage } from "@/followup-email-consumer/process-lead-sink";
import { UnsupportedQueueMessageError } from "@/followup-email-consumer/unsupported-queue-message";
import {
  isLeadSinkQueueMessageType,
  isUnsupportedQueueMessageType,
  parseVisitorFollowupMessage,
  queueMessageTypeLabel,
} from "@/followup-email-consumer/validate";

export { UnsupportedQueueMessageError };

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
  GMAIL_SENDER: string;
  GMAIL_SERVICE_ACCOUNT_JSON: string;
  WE_MET_TEST_MAIL_TO?: string;
  WE_MET_OWNER_FROM_EMAIL?: string;
  WE_MET_ASSETS: R2Bucket;
  WE_MET_DB: D1Database;
};

export type FollowupConsumerDeps = {
  weMetEnv: string;
  gmailSender: string;
  testMailTo?: string;
  emailSender: EmailSender;
  assets: ReadOnlyR2Assets;
  logVisitorFollowupAttemptFailure(
    leadId: string,
    attempt: number,
    error: FollowupEmailErrorLogFields,
    willRetry: boolean,
  ): void;
  logVisitorFollowupPermanentFailure(
    leadId: string,
    error: FollowupEmailErrorLogFields,
  ): void;
  logMalformedVisitorFollowup(leadId: string | null): void;
  logUnsupportedType(typeLabel: string): void;
  logMissingPhoto(key: string): void;
  logNonJpegPhoto(key: string): void;
  logLeadSinkAttemptFailure(
    leadId: string,
    sinkId: string,
    attempt: number,
    error: FollowupEmailErrorLogFields,
    willRetry: boolean,
  ): void;
  logLeadSinkPermanentFailure(
    leadId: string,
    sinkId: string,
    error: FollowupEmailErrorLogFields,
  ): void;
  logMalformedLeadSink(leadId: string | null): void;
  logLedgerRowMissing(leadId: string, sinkId: string): void;
  logLedgerUpdateFailed(leadId: string, sinkId: string, errorCode: string): void;
  sinkHandlers: Map<
    string,
    import("@/followup-email-consumer/lead-sink/types").LeadSinkHandler
  >;
  ledger: import("@/followup-email-consumer/lead-delivery-ledger").ConsumerLeadDeliveryLedger;
  ownerFromEmail?: string;
  now: () => Date;
};

export function createFollowupConsumerDepsFromEnv(
  env: FollowupConsumerEnv,
): FollowupConsumerDeps {
  const ledger = createConsumerLeadDeliveryLedger(env.WE_MET_DB);
  const emailSender = createGmailEmailSender({
    serviceAccountJson: env.GMAIL_SERVICE_ACCOUNT_JSON,
    senderEmail: env.GMAIL_SENDER,
  });
  const logLedgerRowMissing = (leadId: string, sinkId: string) => {
    console.error("ledger_row_missing", { leadId, sinkId });
  };
  const logLedgerUpdateFailed = (leadId: string, sinkId: string, errorCode: string) => {
    console.error("ledger_update_failed", { leadId, sinkId, errorCode });
  };
  const now = () => new Date();

  return {
    weMetEnv: env.WE_MET_ENV,
    gmailSender: env.GMAIL_SENDER,
    testMailTo: env.WE_MET_TEST_MAIL_TO,
    emailSender,
    assets: createReadOnlyConsumerAssets(env.WE_MET_ASSETS),
    logVisitorFollowupAttemptFailure(leadId, attempt, error, willRetry) {
      console.error("visitor_followup_attempt_failure", {
        leadId,
        attempt,
        errorCode: error.code,
        ...(error.secretName ? { secretName: error.secretName } : {}),
        willRetry,
      });
    },
    logVisitorFollowupPermanentFailure(leadId, error) {
      console.error("visitor_followup_permanent_failure", {
        leadId,
        errorCode: error.code,
        ...(error.secretName ? { secretName: error.secretName } : {}),
      });
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
    logLeadSinkAttemptFailure(leadId, sinkId, attempt, error, willRetry) {
      console.error("lead_sink_attempt_failure", {
        leadId,
        sinkId,
        attempt,
        errorCode: error.code,
        ...(error.secretName ? { secretName: error.secretName } : {}),
        willRetry,
      });
    },
    logLeadSinkPermanentFailure(leadId, sinkId, error) {
      console.error("lead_sink_permanent_failure", {
        leadId,
        sinkId,
        errorCode: error.code,
        ...(error.secretName ? { secretName: error.secretName } : {}),
      });
    },
    logMalformedLeadSink(leadId) {
      console.error("lead_sink_malformed", { leadId });
    },
    logLedgerRowMissing,
    logLedgerUpdateFailed,
    ledger,
    ownerFromEmail: env.WE_MET_OWNER_FROM_EMAIL,
    now,
    sinkHandlers: createLeadSinkHandlerRegistry({
      email: createEmailLeadSinkHandler({
        weMetEnv: env.WE_MET_ENV,
        testMailTo: env.WE_MET_TEST_MAIL_TO,
        ownerFromEmail: env.WE_MET_OWNER_FROM_EMAIL,
        emailSender,
        ledger,
        logLedgerRowMissing,
        logLedgerUpdateFailed,
        now,
      }),
    }),
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
  if (isLeadSinkQueueMessageType(message.body)) {
    await processLeadSinkQueueMessage(message, deps);
    return;
  }

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
    const errorFields = followupEmailErrorLogFields(error);
    const willRetry = message.attempts < MAX_VISITOR_FOLLOWUP_ATTEMPTS;
    deps.logVisitorFollowupAttemptFailure(
      parsed.lead.leadId,
      message.attempts,
      errorFields,
      willRetry,
    );
    if (!willRetry) {
      deps.logVisitorFollowupPermanentFailure(parsed.lead.leadId, errorFields);
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
