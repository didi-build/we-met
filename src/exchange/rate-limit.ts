export type ExchangeRateLimiter = {
  check(clientIp: string): Promise<{ allowed: boolean }>;
};

export type CloudflareRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export function createCloudflareExchangeRateLimiter(
  binding: CloudflareRateLimitBinding,
): ExchangeRateLimiter {
  return {
    async check(clientIp: string) {
      const result = await binding.limit({ key: clientIp });
      return { allowed: result.success };
    },
  };
}

export function createNoopExchangeRateLimiter(): ExchangeRateLimiter {
  return {
    async check() {
      return { allowed: true };
    },
  };
}
