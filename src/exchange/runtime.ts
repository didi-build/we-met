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
import type { TurnstileLogger } from "@/exchange/turnstile";

type ExchangeBindings = {
  WE_MET_FOLLOWUP_EMAIL_QUEUE?: CloudflareQueueBinding;
  WE_MET_EXCHANGE_RATE_LIMITER?: CloudflareRateLimitBinding;
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

  return {
    turnstile,
    rateLimiter,
    followupQueue,
    leadSinkQueue,
    tokenSecret,
    environment: hostConfig.weMetEnv,
    clientIp,
    leadSinkLogger: consoleSinkLogger(),
    createLeadId: () => crypto.randomUUID(),
    now: () => new Date(),
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

  return {
    tokenSecret,
    environment: hostConfig.weMetEnv,
    leadSinkQueue,
    leadSinkLogger: consoleSinkLogger(),
    now: () => new Date(),
  };
}
