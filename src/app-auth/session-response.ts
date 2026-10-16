import { loadAccountForSession, validateAndTouchSession } from "@/app-auth/sessions";
import { sessionAllowedForAccount } from "@/app-auth/accounts";
import type { AppSession } from "@/app-api/types";
import type { D1Database } from "@cloudflare/workers-types";

export type AppSessionBuildResult = {
  session: AppSession | null;
  cookieMaxAgeSeconds?: number;
};

export async function buildAppSessionJson(
  db: D1Database,
  sessionToken: string | undefined,
): Promise<AppSessionBuildResult> {
  if (!sessionToken) {
    return { session: null };
  }
  const valid = await validateAndTouchSession(db, sessionToken);
  if (!valid) {
    return { session: null };
  }
  const account = await loadAccountForSession(db, valid.accountId);
  if (!account || account.status === "deleted") {
    return { session: null };
  }
  return {
    session: {
      email: account.email,
      name: account.name,
      allowed: sessionAllowedForAccount(account),
    },
    cookieMaxAgeSeconds: valid.cookieMaxAgeSeconds,
  };
}
