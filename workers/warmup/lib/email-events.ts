import { isSeedRecipient } from "./allowlist";
import {
  nonSeedAlertDedupeKey,
  recipientRedactedForEmailEvent,
  resolveEmailEventDedupeId,
  sendNonSeedEmailEventAlertOnce,
} from "./email-event-alert";
import { parseWarmupSecrets, type WarmupEnv, type WarmupSecrets } from "./config";
import { NonSeedAlertRateSession } from "./nonseed-alert-rate";
import { pauseWarmupAndAlertOnce } from "./pause";
import { redactEmailForLog } from "./redact-email";
import {
  WARMUP_PAUSE_REASON_ASYNC_COMPLAINT,
  WARMUP_PAUSE_REASON_ASYNC_HARD_BOUNCE,
} from "./send-error";

const EVENT_TYPE_COMPLAINED = "cf.email.sending.message.complained";
const EVENT_TYPE_BOUNCED = "cf.email.sending.message.bounced";

export type EmailSendingEvent = {
  type: string;
  payload: {
    recipient: string;
    messageId?: string;
    eventId?: string;
    bounce?: {
      type?: string;
    };
  };
  metadata?: {
    eventSchemaVersion?: number;
  };
};

export type ParsedEmailSendingEvent =
  { ok: true; event: EmailSendingEvent } | { ok: false; reason: string };

export type EmailEventQueueMessage = {
  id: string;
  body: unknown;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

export type EmailEventsBatchContext = {
  nowMs: number;
  rateSession: NonSeedAlertRateSession | null;
};

export function parseEmailSendingEvent(body: unknown): ParsedEmailSendingEvent {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "body_not_object" };
  }
  const record = body as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string" || type.length === 0) {
    return { ok: false, reason: "missing_type" };
  }
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object") {
    return { ok: false, reason: "missing_metadata" };
  }
  const eventSchemaVersion = (metadata as { eventSchemaVersion?: unknown })
    .eventSchemaVersion;
  if (eventSchemaVersion !== 1) {
    return { ok: false, reason: "unsupported_schema_version" };
  }
  const payload = record.payload;
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "missing_payload" };
  }
  const recipient = (payload as { recipient?: unknown }).recipient;
  if (typeof recipient !== "string" || recipient.trim().length === 0) {
    return { ok: false, reason: "missing_recipient" };
  }
  const bounceRaw = (payload as { bounce?: unknown }).bounce;
  let bounce: { type?: string } | undefined;
  if (bounceRaw !== undefined) {
    if (!bounceRaw || typeof bounceRaw !== "object") {
      return { ok: false, reason: "invalid_bounce" };
    }
    const bounceType = (bounceRaw as { type?: unknown }).type;
    if (bounceType !== undefined && typeof bounceType !== "string") {
      return { ok: false, reason: "invalid_bounce_type" };
    }
    bounce = { type: typeof bounceType === "string" ? bounceType : undefined };
  }
  const messageId = (payload as { messageId?: unknown }).messageId;
  const eventId = (payload as { eventId?: unknown }).eventId;
  return {
    ok: true,
    event: {
      type,
      payload: {
        recipient,
        messageId: typeof messageId === "string" ? messageId : undefined,
        eventId: typeof eventId === "string" ? eventId : undefined,
        bounce,
      },
      metadata: { eventSchemaVersion: 1 },
    },
  };
}

export type EmailEventAction =
  "complaint" | "hard_bounce" | "soft_bounce_log" | "ignored_type";

export function classifyEmailSendingEvent(event: EmailSendingEvent): EmailEventAction {
  if (event.type === EVENT_TYPE_COMPLAINED) {
    return "complaint";
  }
  if (event.type === EVENT_TYPE_BOUNCED) {
    const bounceType = event.payload.bounce?.type;
    if (bounceType === "hard") {
      return "hard_bounce";
    }
    return "soft_bounce_log";
  }
  return "ignored_type";
}

export async function handleParsedEmailSendingEvent(
  env: WarmupEnv,
  secrets: WarmupSecrets,
  event: EmailSendingEvent,
  queueMessageId: string,
  batchContext?: EmailEventsBatchContext,
): Promise<"acked" | "retry"> {
  const action = classifyEmailSendingEvent(event);
  const recipientRedacted = recipientRedactedForEmailEvent(event.payload.recipient);

  if (action === "soft_bounce_log") {
    console.log("warmup_email_event_soft_bounce", {
      queueMessageId,
      recipient: recipientRedacted,
    });
    return "acked";
  }
  if (action === "ignored_type") {
    console.log("warmup_email_event_ignored", {
      queueMessageId,
      eventType: event.type,
      recipient: recipientRedacted,
    });
    return "acked";
  }
  if (action !== "complaint" && action !== "hard_bounce") {
    return "acked";
  }

  const seed = isSeedRecipient(event.payload.recipient, secrets.seeds);
  if (seed) {
    const reason =
      action === "complaint"
        ? WARMUP_PAUSE_REASON_ASYNC_COMPLAINT
        : WARMUP_PAUSE_REASON_ASYNC_HARD_BOUNCE;
    console.log("warmup_email_event_pause_seed", {
      queueMessageId,
      eventType: event.type,
      reason,
      recipient: recipientRedacted,
    });
    await pauseWarmupAndAlertOnce(env, secrets, reason);
    return "acked";
  }

  const dedupeId = resolveEmailEventDedupeId(event.payload) ?? queueMessageId;
  const dedupeKey = nonSeedAlertDedupeKey(dedupeId);
  console.log("warmup_email_event_alert_non_seed", {
    queueMessageId,
    eventType: event.type,
    recipient: recipientRedacted,
  });
  const kv = env.WARMUP_STATE;
  let rateSession = batchContext?.rateSession ?? null;
  if (batchContext && kv && !rateSession) {
    const opened = await NonSeedAlertRateSession.open(kv, env, batchContext.nowMs);
    if (opened === "read_failed") {
      return "retry";
    }
    batchContext.rateSession = opened;
    rateSession = opened;
  }

  const alertResult = await sendNonSeedEmailEventAlertOnce(
    env,
    secrets,
    {
      dedupeKey,
      eventType: event.type,
      recipientRedacted,
    },
    {
      now: new Date(batchContext?.nowMs ?? Date.now()),
      rateSession,
      commitRateSession: batchContext === undefined,
    },
  );
  if (
    alertResult === "sent_individual" ||
    alertResult === "sent_summary" ||
    alertResult === "suppressed" ||
    alertResult === "deduped"
  ) {
    return "acked";
  }
  if (alertResult === "skipped" || alertResult === "failed") {
    const kv = env.WARMUP_STATE;
    const alertTo = env.WARMUP_ALERT_TO?.trim();
    if (!kv || !alertTo || !env.EMAIL || !parseWarmupSecrets(env)) {
      return "retry";
    }
    const existing = await kv.get(dedupeKey);
    if (existing) {
      return "acked";
    }
    return "retry";
  }
  return "acked";
}

export async function processEmailEventsBatch(
  batch: { messages: readonly EmailEventQueueMessage[] },
  env: WarmupEnv,
): Promise<void> {
  const secrets = parseWarmupSecrets(env);
  const kv = env.WARMUP_STATE;
  if (!secrets || !kv) {
    console.error("warmup_email_events_missing_config", {
      missingSecrets: !secrets,
      missingKv: !kv,
    });
    for (const message of batch.messages) {
      message.retry();
    }
    return;
  }

  const batchContext: EmailEventsBatchContext = {
    nowMs: Date.now(),
    rateSession: null,
  };

  for (const message of batch.messages) {
    const parsed = parseEmailSendingEvent(message.body);
    if (!parsed.ok) {
      console.error("warmup_email_event_invalid", {
        queueMessageId: message.id,
        reason: parsed.reason,
        recipient: extractRecipientHintForLog(message.body),
      });
      message.retry();
      continue;
    }

    const outcome = await handleParsedEmailSendingEvent(
      env,
      secrets,
      parsed.event,
      message.id,
      batchContext,
    );
    if (outcome === "retry") {
      message.retry();
      continue;
    }
    message.ack();
  }

  if (batchContext.rateSession?.isDirty()) {
    const written = await batchContext.rateSession.commit(kv);
    if (!written) {
      console.error("warmup_email_event_alert_window_write_failed", {
        scope: "batch",
      });
    }
  }
}

function extractRecipientHintForLog(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const payload = (body as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const recipient = (payload as { recipient?: unknown }).recipient;
  if (typeof recipient !== "string") {
    return undefined;
  }
  return redactEmailForLog(recipient);
}
