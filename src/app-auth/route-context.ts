import { parseCookieHeader, SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import {
  assertAppApiHost,
  readHostConfigFromEnv,
  requestHostname,
  type AppAuthEnv,
} from "@/app-auth/guards";
import { createAppRateLimiter, createAuthRateLimiter } from "@/app-auth/rate-limit";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";

export async function readAppAuthBindings(): Promise<{
  env: AppAuthEnv & {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    WE_MET_PREVIEW_LOGIN_SECRET?: string;
    WE_MET_PREVIEW_LOGIN_EMAIL?: string;
    WE_MET_AUTH_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
    WE_MET_APP_RATE_LIMITER?: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
    WE_MET_DB: import("@cloudflare/workers-types").D1Database;
  };
  hostname: string;
  hostConfig: ReturnType<typeof readHostConfigFromEnv>;
  cookieHeader: string | null;
  sessionToken: string | undefined;
  authRateLimiter: ReturnType<typeof createAuthRateLimiter>;
  appRateLimiter: ReturnType<typeof createAppRateLimiter>;
}> {
  const { env } = await getCloudflareContext({ async: true });
  const headerList = await headers();
  const hostname = requestHostname(headerList);
  const hostConfig = readHostConfigFromEnv(env);
  const cookieHeader = headerList.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const sessionToken = cookies.get(SESSION_COOKIE_NAME);

  const authRateLimiter = createAuthRateLimiter(
    env.WE_MET_AUTH_RATE_LIMITER,
    hostConfig.weMetEnv,
  );
  const appRateLimiter = createAppRateLimiter(
    env.WE_MET_APP_RATE_LIMITER,
    hostConfig.weMetEnv,
  );

  return {
    env,
    hostname,
    hostConfig,
    cookieHeader,
    sessionToken,
    authRateLimiter,
    appRateLimiter,
  };
}

export function ensureAppApiHost(
  hostname: string,
  hostConfig: ReturnType<typeof readHostConfigFromEnv>,
): boolean {
  return assertAppApiHost(hostname, hostConfig);
}
