import type { CloudflareRateLimitBinding } from "@/exchange/rate-limit";

export type AuthRateLimiter = {
  check(clientIp: string): Promise<boolean>;
};

export type AppRateLimiter = {
  check(accountId: string, routeKey: string): Promise<boolean>;
};

export function createAuthRateLimiter(
  binding: CloudflareRateLimitBinding | undefined,
  weMetEnv: string,
): AuthRateLimiter {
  if (weMetEnv === "local" || !binding) {
    return {
      async check() {
        return true;
      },
    };
  }
  return {
    async check(clientIp: string) {
      const result = await binding.limit({ key: `auth:${clientIp}` });
      return result.success;
    },
  };
}

export function createAppRateLimiter(
  binding: CloudflareRateLimitBinding | undefined,
  weMetEnv: string,
): AppRateLimiter {
  if (weMetEnv === "local" || !binding) {
    return {
      async check() {
        return true;
      },
    };
  }
  return {
    async check(accountId: string, routeKey: string) {
      const result = await binding.limit({ key: `app:${routeKey}:${accountId}` });
      return result.success;
    },
  };
}
