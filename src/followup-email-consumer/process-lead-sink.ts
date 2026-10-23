import {
  followupEmailErrorLogFields,
  type FollowupEmailErrorLogFields,
} from "@/email/followup-email-error";
import { isRetryableFollowupEmailError } from "@/email/retryable-followup-error";
import type { LeadEmailControls } from "@/app-settings/caps";
import {
  parseExternalRef,
  validateExternalRefForStorage,
} from "@/followup-email-consumer/external-ref";
import type { ConsumerLeadDeliveryLedger } from "@/followup-email-consumer/lead-delivery-ledger";
import { getLeadSinkHandler } from "@/followup-email-consumer/lead-sink/registry";
import type {
  LeadSinkHandler,
  ParsedExternalRef,
  ParsedLeadSinkMessage,
} from "@/followup-email-consumer/lead-sink/types";
import {
  followupEmailRetryDelaySeconds,
  MAX_VISITOR_FOLLOWUP_ATTEMPTS,
} from "@/followup-email-consumer/retry";
import { parseLeadSinkMessage } from "@/followup-email-consumer/validate";
import type { FollowupQueueMessage } from "@/followup-email-consumer/process-batch";
import { UnsupportedQueueMessageError } from "@/followup-email-consumer/unsupported-queue-message";
import { LEAD_EMAIL_PAUSED_ERROR } from "@/lead-email/paused";

export type LeadSinkConsumerDeps = {
  readLeadEmailControls: () => Promise<LeadEmailControls>;
  sinkHandlers: Map<string, LeadSinkHandler>;
  ledger: ConsumerLeadDeliveryLedger;
  logUnsupportedType(typeLabel: string): void;
  logMalformedLeadSink(leadId: string | null): void;
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
  logLeadSinkLedgerRecordFailed(
    leadId: string,
    sinkId: string,
    errorCode: string,
  ): void;
  logLeadSinkLedgerMarkFailed(leadId: string, sinkId: string, errorCode: string): void;
  logLedgerRowMissing(leadId: string, sinkId: string): void;
  logLedgerUpdateFailed(leadId: string, sinkId: string, errorCode: string): void;
  logLeadSinkAppendDeferred(leadId: string, sinkId: string, attempt: number): void;
  now: () => Date;
};

function leadSinkPhase(message: ParsedLeadSinkMessage): "record" | "append" {
  return message.type === "lead_sink_record" ? "record" : "append";
}

function leadIdFromBody(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body &&
    "lead" in body &&
    typeof (body as { lead?: { leadId?: string } }).lead?.leadId === "string"
  ) {
    return (body as { lead: { leadId: string } }).lead.leadId;
  }
  return null;
}

async function recordRetryableFailure(
  message: FollowupQueueMessage,
  parsed: ParsedLeadSinkMessage,
  errorFields: FollowupEmailErrorLogFields,
  deps: LeadSinkConsumerDeps,
): Promise<void> {
  const phase = leadSinkPhase(parsed);
  const willRetry = message.attempts < MAX_VISITOR_FOLLOWUP_ATTEMPTS;
  deps.logLeadSinkAttemptFailure(
    parsed.lead.leadId,
    parsed.sinkId,
    message.attempts,
    errorFields,
    willRetry,
  );

  const updatedAt = deps.now().toISOString();
  const delaySeconds = followupEmailRetryDelaySeconds(message.attempts);
  const nextAttemptAt = new Date(
    deps.now().getTime() + delaySeconds * 1000,
  ).toISOString();

  try {
    await deps.ledger.recordFailedAttempt({
      leadId: parsed.lead.leadId,
      sinkId: parsed.sinkId,
      phase,
      attemptCount: message.attempts,
      nextAttemptAt,
      updatedAt,
    });
  } catch {
    deps.logLeadSinkLedgerRecordFailed(
      parsed.lead.leadId,
      parsed.sinkId,
      errorFields.code,
    );
  }

  if (!willRetry) {
    deps.logLeadSinkPermanentFailure(parsed.lead.leadId, parsed.sinkId, errorFields);
    try {
      await deps.ledger.markFailed({
        leadId: parsed.lead.leadId,
        sinkId: parsed.sinkId,
        phase,
        errorCode: errorFields.code,
        updatedAt,
      });
    } catch {
      deps.logLeadSinkLedgerMarkFailed(
        parsed.lead.leadId,
        parsed.sinkId,
        errorFields.code,
      );
    }
    message.ack();
    return;
  }

  message.retry({ delaySeconds });
}

async function markNonRetryableFailure(
  message: FollowupQueueMessage,
  parsed: ParsedLeadSinkMessage,
  errorCode: string,
  deps: LeadSinkConsumerDeps,
): Promise<void> {
  const phase = leadSinkPhase(parsed);
  const updatedAt = deps.now().toISOString();
  try {
    await deps.ledger.markFailed({
      leadId: parsed.lead.leadId,
      sinkId: parsed.sinkId,
      phase,
      errorCode,
      updatedAt,
    });
  } catch {
    deps.logLeadSinkLedgerMarkFailed(parsed.lead.leadId, parsed.sinkId, errorCode);
  }
  message.ack();
}

async function afterSuccessfulDelivery(
  message: FollowupQueueMessage,
  parsed: ParsedLeadSinkMessage,
  externalRef: string | null,
  deps: LeadSinkConsumerDeps,
): Promise<void> {
  const phase = leadSinkPhase(parsed);
  const validation = validateExternalRefForStorage(externalRef);
  const storedRef = validation.ok ? validation.stored : null;
  if (!validation.ok) {
    deps.logLedgerUpdateFailed(parsed.lead.leadId, parsed.sinkId, validation.code);
  }

  const sentAt = deps.now().toISOString();
  try {
    const updated = await deps.ledger.markSent({
      leadId: parsed.lead.leadId,
      sinkId: parsed.sinkId,
      phase,
      sentAt,
      externalRef: storedRef,
    });
    if (!updated) {
      deps.logLedgerUpdateFailed(
        parsed.lead.leadId,
        parsed.sinkId,
        "ledger_update_failed",
      );
    }
  } catch {
    deps.logLedgerUpdateFailed(
      parsed.lead.leadId,
      parsed.sinkId,
      "ledger_update_failed",
    );
  }
  message.ack();
}

async function resolveAppendRecordRef(
  message: FollowupQueueMessage,
  parsed: ParsedLeadSinkMessage,
  handler: LeadSinkHandler,
  deps: LeadSinkConsumerDeps,
): Promise<
  | { action: "defer" }
  | { action: "fail"; errorCode: "record_unavailable" }
  | { action: "deliver"; recordRef: ParsedExternalRef | null }
> {
  const recordRow = await deps.ledger.findRow(
    parsed.lead.leadId,
    parsed.sinkId,
    "record",
  );

  if (recordRow?.status === "queued") {
    const willRetry = message.attempts < MAX_VISITOR_FOLLOWUP_ATTEMPTS;
    if (willRetry) {
      return { action: "defer" };
    }
    if (handler.appendRequiresRecord) {
      return { action: "fail", errorCode: "record_unavailable" };
    }
    return { action: "deliver", recordRef: null };
  }

  if (recordRow?.status === "sent") {
    return {
      action: "deliver",
      recordRef: parseExternalRef(recordRow.externalRef),
    };
  }

  if (handler.appendRequiresRecord) {
    return { action: "fail", errorCode: "record_unavailable" };
  }
  return { action: "deliver", recordRef: null };
}

async function processQueuedLeadSink(
  message: FollowupQueueMessage,
  parsed: ParsedLeadSinkMessage,
  handler: LeadSinkHandler,
  deps: LeadSinkConsumerDeps,
): Promise<void> {
  const phase = leadSinkPhase(parsed);
  const row = await deps.ledger.findRow(parsed.lead.leadId, parsed.sinkId, phase);
  if (!row) {
    deps.logLedgerRowMissing(parsed.lead.leadId, parsed.sinkId);
    message.ack();
    return;
  }
  if (row.status === "sent" || row.status === "failed") {
    message.ack();
    return;
  }

  const leadEmailControls = await deps.readLeadEmailControls();
  if (!leadEmailControls.leadEmailEnabled) {
    await markNonRetryableFailure(message, parsed, LEAD_EMAIL_PAUSED_ERROR, deps);
    return;
  }

  const handlerContext = {
    messageAttempts: message.attempts,
    emailProvider: leadEmailControls.emailProvider,
    visitorEmailMode: leadEmailControls.visitorEmailMode,
  };

  try {
    if (parsed.type === "lead_sink_record") {
      const result = await handler.deliverRecord(parsed, handlerContext);
      await afterSuccessfulDelivery(message, parsed, result.externalRef, deps);
      return;
    }

    const appendPlan = await resolveAppendRecordRef(message, parsed, handler, deps);
    if (appendPlan.action === "defer") {
      deps.logLeadSinkAppendDeferred(
        parsed.lead.leadId,
        parsed.sinkId,
        message.attempts,
      );
      message.retry({ delaySeconds: followupEmailRetryDelaySeconds(message.attempts) });
      return;
    }
    if (appendPlan.action === "fail") {
      await markNonRetryableFailure(message, parsed, appendPlan.errorCode, deps);
      return;
    }

    const result = await handler.deliverAppend(parsed, {
      ...handlerContext,
      recordRef: appendPlan.recordRef,
    });
    await afterSuccessfulDelivery(message, parsed, result.externalRef, deps);
  } catch (error) {
    const errorFields = followupEmailErrorLogFields(error);
    if (!isRetryableFollowupEmailError(errorFields.code)) {
      await markNonRetryableFailure(message, parsed, errorFields.code, deps);
      return;
    }
    await recordRetryableFailure(message, parsed, errorFields, deps);
  }
}

export async function processLeadSinkQueueMessage(
  message: FollowupQueueMessage,
  deps: LeadSinkConsumerDeps,
): Promise<void> {
  const parsed = parseLeadSinkMessage(message.body);
  if (!parsed) {
    const leadId = leadIdFromBody(message.body);
    deps.logMalformedLeadSink(leadId);
    const sinkId =
      typeof message.body === "object" &&
      message.body &&
      "sinkId" in message.body &&
      typeof (message.body as { sinkId?: string }).sinkId === "string"
        ? (message.body as { sinkId: string }).sinkId
        : null;
    if (leadId && sinkId) {
      const phase =
        typeof message.body === "object" &&
        message.body &&
        (message.body as { type?: string }).type === "lead_sink_append_details"
          ? "append"
          : "record";
      try {
        await deps.ledger.markFailed({
          leadId,
          sinkId,
          phase,
          errorCode: "malformed_message",
          updatedAt: deps.now().toISOString(),
        });
      } catch {
        // Best-effort.
      }
    }
    message.ack();
    return;
  }

  const handler = getLeadSinkHandler(deps.sinkHandlers, parsed.sinkKind);
  if (!handler) {
    deps.logUnsupportedType(parsed.sinkKind);
    throw new UnsupportedQueueMessageError(parsed.sinkKind);
  }

  await processQueuedLeadSink(message, parsed, handler, deps);
}
