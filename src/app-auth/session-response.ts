import { isContactsSetupSuppressed } from "@/app-auth/cookies";
import { computeContactsSetupUi } from "@/app-auth/contacts-setup-visibility";
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
  options?: {
    env?: CloudflareEnv;
    cookies?: Map<string, string>;
  },
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
  const env = options?.env;
  const suppressed = options?.cookies
    ? isContactsSetupSuppressed(options.cookies)
    : false;
  const contactsSetup =
    env && sessionAllowedForAccount(account)
      ? computeContactsSetupUi(env, account, suppressed)
      : { visible: false as const };

  return {
    session: {
      email: account.email,
      name: account.name,
      allowed: sessionAllowedForAccount(account),
      contactsSetup,
    },
    cookieMaxAgeSeconds: valid.cookieMaxAgeSeconds,
  };
}
