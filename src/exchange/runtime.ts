import type { D1Database } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readWeMetHostConfig } from "@/config/we-met";
import type { CloudflareRateLimitBinding } from "@/exchange/rate-limit";
import {
  requireSecret,
  selectExchangeRateLimiter,
  selectTurnstileVerifier,
} from "@/exchange/runtime-adapters";
import {
  createCloudflareFollowupEmailQueueProducer,
  createCloudflareLeadSinkQueueProducer,
  requireQueueBinding,
  type CloudflareQueueBinding,
} from "@/exchange/queue/producer";
import type { ProcessDetailsDeps } from "@/exchange/process-details";
import type { ProcessExchangeDeps } from "@/exchange/process-exchange";
import type { ProcessVCardDeps } from "@/exchange/process-vcard";
import { createReadOnlyR2Assets } from "@/assets/read-only-r2-assets";
import type { R2Bucket } from "@cloudflare/workers-types";
import type { TurnstileLogger } from "@/exchange/turnstile";
import { createExchangeOwnerEmailStoreFromD1 } from "@/exchange-owner-email/d1-repository";
import { createLeadDeliveryLedgerFromD1 } from "@/lead-delivery-ledger/d1-repository";
import { readLeadEmailControls } from "@/app-settings/caps";
import { assertLeadEmailCapacity } from "@/lead-email/availability";
import {
  incrementDailySendCounts,
  utcDayFromDate,
} from "@/lead-email/daily-send-counts";

type ExchangeBindings = {
  WE_MET_FOLLOWUP_EMAIL_QUEUE?: CloudflareQueueBinding;
  WE_MET_EXCHANGE_RATE_LIMITER?: CloudflareRateLimitBinding;
  WE_MET_ASSETS?: R2Bucket;
  TURNSTILE_SECRET_KEY?: string;
  WE_MET_TOKEN_SECRET?: string;
  WE_MET_ENV?: string;
};

function consoleTurnstileLogger(): TurnstileLogger {
  return {
    logSiteverifyErrors(codes: string[]) {
      console.error("turnstile siteverify failed", { errorCodes: codes });
    },
  };
}

function consoleSinkLogger() {
  return {
    logSinkEnqueueFailure(sinkId: string, error: unknown) {
      console.error("lead sink enqueue failed", { sinkId, error });
    },
  };
}

function consoleDeliveryLogger() {
  return {
    logLedgerWriteFailed(leadId: string, sinkId: string, errorCode: string) {
      console.error("lead_delivery_ledger_write_failed", {
        leadId,
        sinkId,
        errorCode,
      });
    },
    logLedgerEnqueueFailed(leadId: string, sinkId: string, errorCode: string) {
      console.error("lead_delivery_ledger_enqueue_failed", {
        leadId,
        sinkId,
        errorCode,
      });
    },
  };
}

export async function createProcessExchangeDeps(
  clientIp: string,
): Promise<ProcessExchangeDeps> {
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as ExchangeBindings;
  const hostConfig = readWeMetHostConfig(env);

  const queue = requireQueueBinding(
    bindings.WE_MET_FOLLOWUP_EMAIL_QUEUE,
    "WE_MET_FOLLOWUP_EMAIL_QUEUE",
  );

  const rateLimiter = selectExchangeRateLimiter(
    hostConfig.weMetEnv,
    bindings.WE_MET_EXCHANGE_RATE_LIMITER,
  );

  const turnstile = selectTurnstileVerifier(
    hostConfig.weMetEnv,
    bindings.TURNSTILE_SECRET_KEY,
    consoleTurnstileLogger(),
  );

  const tokenSecret = requireSecret(
    "WE_MET_TOKEN_SECRET",
    bindings.WE_MET_TOKEN_SECRET,
  );

  const followupQueue = createCloudflareFollowupEmailQueueProducer(queue);
  const leadSinkQueue = createCloudflareLeadSinkQueueProducer(queue);
  const db = (env as { WE_MET_DB?: D1Database }).WE_MET_DB;
  if (!db) {
    throw new Error("WE_MET_DB binding is not configured");
  }
  const deliveryLedger = createLeadDeliveryLedgerFromD1(db);
  const exchangeOwnerEmail = createExchangeOwnerEmailStoreFromD1(db);
  const now = () => new Date();

  return {
    turnstile,
    rateLimiter,
    followupQueue,
    leadSinkQueue,
    deliveryLedger,
    exchangeOwnerEmail,
    deliveryLogger: consoleDeliveryLogger(),
    tokenSecret,
    environment: hostConfig.weMetEnv,
    clientIp,
    leadSinkLogger: consoleSinkLogger(),
    createLeadId: () => crypto.randomUUID(),
    createLedgerId: () => crypto.randomUUID(),
    now,
    baseUrl: hostConfig.baseUrl,
    assertLeadEmailCapacity: (cardId, needed) =>
      assertLeadEmailCapacity(db, cardId, needed, now()),
    readVisitorEmailMode: async () => {
      const controls = await readLeadEmailControls(db);
      return controls.visitorEmailMode;
    },
    incrementDailySendCounts: (cardId, kinds) =>
      incrementDailySendCounts(db, utcDayFromDate(now()), cardId, kinds),
  };
}

export async function createProcessVCardDeps(
  clientIp: string,
): Promise<ProcessVCardDeps> {
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as ExchangeBindings;
  const hostConfig = readWeMetHostConfig(env);

  const rateLimiter = selectExchangeRateLimiter(
    hostConfig.weMetEnv,
    bindings.WE_MET_EXCHANGE_RATE_LIMITER,
  );

  const tokenSecret = requireSecret(
    "WE_MET_TOKEN_SECRET",
    bindings.WE_MET_TOKEN_SECRET,
  );

  if (!bindings.WE_MET_ASSETS) {
    throw new Error("WE_MET_ASSETS binding is not configured");
  }

  const now = () => new Date();

  return {
    tokenSecret,
    rateLimiter,
    clientIp,
    assets: createReadOnlyR2Assets(bindings.WE_MET_ASSETS),
    now,
  };
}

export async function createProcessDetailsDeps(): Promise<ProcessDetailsDeps> {
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as ExchangeBindings;
  const hostConfig = readWeMetHostConfig(env);

  const queue = requireQueueBinding(
    bindings.WE_MET_FOLLOWUP_EMAIL_QUEUE,
    "WE_MET_FOLLOWUP_EMAIL_QUEUE",
  );

  const tokenSecret = requireSecret(
    "WE_MET_TOKEN_SECRET",
    bindings.WE_MET_TOKEN_SECRET,
  );
  const leadSinkQueue = createCloudflareLeadSinkQueueProducer(queue);
  const db = (env as { WE_MET_DB?: D1Database }).WE_MET_DB;
  if (!db) {
    throw new Error("WE_MET_DB binding is not configured");
  }
  const deliveryLedger = createLeadDeliveryLedgerFromD1(db);
  const exchangeOwnerEmail = createExchangeOwnerEmailStoreFromD1(db);
  const now = () => new Date();

  return {
    tokenSecret,
    environment: hostConfig.weMetEnv,
    leadSinkQueue,
    deliveryLedger,
    exchangeOwnerEmail,
    deliveryLogger: consoleDeliveryLogger(),
    leadSinkLogger: consoleSinkLogger(),
    createLedgerId: () => crypto.randomUUID(),
    now,
    baseUrl: hostConfig.baseUrl,
  };
}
