import { constantTimeEqual } from "@/app-auth/crypto";

export const PREVIEW_GOOGLE_SUB = "preview:test";

export function isPreviewLoginEnvironment(weMetEnv: string | undefined): boolean {
  return weMetEnv?.trim() === "preview";
}

export function previewLoginAllowed(
  weMetEnv: string | undefined,
  secretConfigured: boolean,
): boolean {
  return isPreviewLoginEnvironment(weMetEnv) && secretConfigured;
}

export function verifyPreviewLoginSecret(provided: string, expected: string): boolean {
  if (!expected || !provided) {
    return false;
  }
  return constantTimeEqual(provided, expected);
}

export function isPreviewLoginRouteEnabled(env: {
  WE_MET_ENV?: string;
  WE_MET_PREVIEW_LOGIN_SECRET?: string;
}): boolean {
  const secret = env.WE_MET_PREVIEW_LOGIN_SECRET?.trim();
  return previewLoginAllowed(env.WE_MET_ENV, Boolean(secret));
}
