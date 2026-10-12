import {
  createCloudflareExchangeRateLimiter,
  createNoopExchangeRateLimiter,
  type CloudflareRateLimitBinding,
  type ExchangeRateLimiter,
} from "@/exchange/rate-limit";
import {
  createAlwaysPassTurnstileVerifier,
  createCloudflareTurnstileVerifier,
  type TurnstileLogger,
  type TurnstileVerifier,
} from "@/exchange/turnstile";

export class MissingRateLimiterBindingError extends Error {
  constructor(bindingName: string) {
    super(`Missing required rate limiter binding: ${bindingName}`);
    this.name = "MissingRateLimiterBindingError";
  }
}

export function requireSecret(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return trimmed;
}

export function selectExchangeRateLimiter(
  weMetEnv: string,
  binding: CloudflareRateLimitBinding | undefined,
): ExchangeRateLimiter {
  if (weMetEnv === "local") {
    return createNoopExchangeRateLimiter();
  }
  if (!binding) {
    throw new MissingRateLimiterBindingError("WE_MET_EXCHANGE_RATE_LIMITER");
  }
  return createCloudflareExchangeRateLimiter(binding);
}

export function selectTurnstileVerifier(
  weMetEnv: string,
  turnstileSecretKey: string | undefined,
  logger: TurnstileLogger,
): TurnstileVerifier {
  if (weMetEnv === "local") {
    return createAlwaysPassTurnstileVerifier();
  }
  return createCloudflareTurnstileVerifier(
    requireSecret("TURNSTILE_SECRET_KEY", turnstileSecretKey),
    logger,
  );
}
