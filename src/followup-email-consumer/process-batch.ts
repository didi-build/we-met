import { readWeMetHostConfig } from "@/config/we-met";
import { buildVisitorFollowUpEmail } from "@/email/format-visitor-follow-up";
import {
  followupEmailErrorLogFields,
  type FollowupEmailErrorLogFields,
} from "@/email/followup-email-error";
import type { EmailProvider } from "@/email/email-provider";
import {
  createConsumerOutboundEmailSend,
  type ConsumerOutboundEmailSend,
} from "@/email/email-provider";
import { isRetryableFollowupEmailError } from "@/email/retryable-followup-error";
import {
  resolveOutboundFromEmail,
  type OutboundFromSecrets,
} from "@/email/resolve-outbound-from";
import { sanitizeEmailHeaderValue } from "@/email/mime-headers";
import {
  resolveFromDisplayName,
  resolveVisitorFromDisplayName,
} from "@/email/from-display-name";
import { resolveEmailRecipient } from "@/email/recipient";
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
import { readLeadEmailControls, type LeadEmailControls } from "@/app-settings/caps";
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
  WE_MET_BASE_URL: string;
  GMAIL_SENDER: string;
  GMAIL_SERVICE_ACCOUNT_JSON: string;
  EMAIL?: import("@/email/cloudflare-sender").CloudflareSendEmailBinding;
  WE_MET_TEST_MAIL_TO?: string;
  WE_MET_OWNER_FROM_EMAIL?: string;
  WE_MET_EMAIL_FROM_CLOUDFLARE?: string;
  WE_MET_FROM_DISPLAY_NAME?: string;
  WE_MET_ASSETS: R2Bucket;
  WE_MET_DB: D1Database;
};

export type FollowupConsumerDeps = {
  readLeadEmailControls: () => Promise<LeadEmailControls>;
  weMetEnv: string;
  baseUrl: string;
  testMailTo?: string;
  sendEmail: ConsumerOutboundEmailSend;
  outboundFrom: OutboundFromSecrets;
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
  logVisitorFollowupDroppedPaused(leadId: string): void;
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
  logLeadSinkLedgerRecordFailed(
    leadId: string,
    sinkId: string,
    errorCode: string,
  ): void;
  logLeadSinkLedgerMarkFailed(leadId: string, sinkId: string, errorCode: string): void;
  logLeadSinkAppendDeferred(leadId: string, sinkId: string, attempt: number): void;
  sinkHandlers: Map<
    string,
    import("@/followup-email-consumer/lead-sink/types").LeadSinkHandler
  >;
  ledger: import("@/followup-email-consumer/lead-delivery-ledger").ConsumerLeadDeliveryLedger;
  fromDisplayName?: string;
  now: () => Date;
};

export function createFollowupConsumerDepsFromEnv(
  env: FollowupConsumerEnv,
): FollowupConsumerDeps {
  const ledger = createConsumerLeadDeliveryLedger(env.WE_MET_DB);
  const sendEmail = createConsumerOutboundEmailSend(env);
  const outboundFrom: OutboundFromSecrets = {
    ownerFromEmail: env.WE_MET_OWNER_FROM_EMAIL,
    cloudflareFromEmail: env.WE_MET_EMAIL_FROM_CLOUDFLARE,
  };
  const logLedgerRowMissing = (leadId: string, sinkId: string) => {
    console.error("ledger_row_missing", { leadId, sinkId });
  };
  const logLedgerUpdateFailed = (leadId: string, sinkId: string, errorCode: string) => {
    console.error("ledger_update_failed", { leadId, sinkId, errorCode });
  };
  const logLeadSinkLedgerRecordFailed = (
    leadId: string,
    sinkId: string,
    errorCode: string,
  ) => {
    console.error("lead_sink_ledger_record_failed", { leadId, sinkId, errorCode });
  };
  const logLeadSinkLedgerMarkFailed = (
    leadId: string,
    sinkId: string,
    errorCode: string,
  ) => {
    console.error("lead_sink_ledger_mark_failed", { leadId, sinkId, errorCode });
  };
  const now = () => new Date();
  const { baseUrl } = readWeMetHostConfig(env);

  return {
    readLeadEmailControls: () => readLeadEmailControls(env.WE_MET_DB),
    weMetEnv: env.WE_MET_ENV,
    baseUrl,
    testMailTo: env.WE_MET_TEST_MAIL_TO,
    sendEmail,
    outboundFrom,
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
    logVisitorFollowupDroppedPaused(leadId) {
      console.error("visitor_followup_dropped_paused", { leadId });
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
    logLeadSinkLedgerRecordFailed,
    logLeadSinkLedgerMarkFailed,
    logLeadSinkAppendDeferred(leadId, sinkId, attempt) {
      console.error("lead_sink_append_deferred", { leadId, sinkId, attempt });
    },
    ledger,
    fromDisplayName: env.WE_MET_FROM_DISPLAY_NAME,
    now,
    sinkHandlers: createLeadSinkHandlerRegistry({
      email: createEmailLeadSinkHandler({
        weMetEnv: env.WE_MET_ENV,
        testMailTo: env.WE_MET_TEST_MAIL_TO,
        outboundFrom,
        fromDisplayName: env.WE_MET_FROM_DISPLAY_NAME,
        sendEmail,
        logMalformedLeadSink(leadId) {
          console.error("lead_sink_malformed", { leadId });
        },
      }),
    }),
  };
}

async function sendVisitorFollowup(
  message: NonNullable<ReturnType<typeof parseVisitorFollowupMessage>>,
  deps: FollowupConsumerDeps,
  emailProvider: EmailProvider,
): Promise<void> {
  const ownerFrom = resolveOutboundFromEmail(emailProvider, deps.outboundFrom);
  const platformFromDisplayName = resolveFromDisplayName(deps.fromDisplayName);
  const fromDisplayName = resolveVisitorFromDisplayName(
    message.card.contact.name.given,
    platformFromDisplayName,
  );
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
    baseUrl: deps.baseUrl,
    nonProdVisitorEmailLabel: nonProdLabel,
  });

  const { vcardBody, filename } = await buildOwnerVCardAttachment(
    message.card.contact,
    message.card.email,
    message.card.photoKey,
    deps.assets,
    deps,
  );

  await deps.sendEmail(emailProvider, {
    from: ownerFrom,
    fromDisplayName,
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

  const leadEmailControls = await deps.readLeadEmailControls();
  if (!leadEmailControls.leadEmailEnabled) {
    deps.logVisitorFollowupDroppedPaused(parsed.lead.leadId);
    message.ack();
    return;
  }

  try {
    await sendVisitorFollowup(parsed, deps, leadEmailControls.emailProvider);
    message.ack();
  } catch (error) {
    const errorFields = followupEmailErrorLogFields(error);
    if (!isRetryableFollowupEmailError(errorFields.code)) {
      deps.logVisitorFollowupPermanentFailure(parsed.lead.leadId, errorFields);
      message.ack();
      return;
    }
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
