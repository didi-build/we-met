import { parseCookieHeader, SESSION_COOKIE_NAME } from "@/app-auth/cookies";
import { isContactsSetupEligible } from "@/app-auth/contacts-setup-config";
import { sessionAllowedForAccount, type AccountRow } from "@/app-auth/accounts";
import { loadAccountForSession, validateAndTouchSession } from "@/app-auth/sessions";
import type { D1Database } from "@cloudflare/workers-types";

export async function loadContactsCallbackSessionAccount(
  db: D1Database,
  env: CloudflareEnv,
  cookieHeader: string | null,
  expectedAccountId: string,
): Promise<AccountRow | null> {
  const cookies = parseCookieHeader(cookieHeader);
  const sessionToken = cookies.get(SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return null;
  }
  const valid = await validateAndTouchSession(db, sessionToken);
  if (!valid || valid.accountId !== expectedAccountId) {
    return null;
  }
  const account = await loadAccountForSession(db, valid.accountId);
  if (!account || !sessionAllowedForAccount(account)) {
    return null;
  }
  if (!isContactsSetupEligible(env, account.email)) {
    return null;
  }
  return account;
}
