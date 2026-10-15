import { loadAccountForSession, validateAndTouchSession } from "@/app-auth/sessions";
import { sessionAllowedForAccount } from "@/app-auth/accounts";
import type { AppSession } from "@/app-api/types";
import type { D1Database } from "@cloudflare/workers-types";

export async function buildAppSessionJson(
  db: D1Database,
  sessionToken: string | undefined,
): Promise<AppSession | null> {
  if (!sessionToken) {
    return null;
  }
  const valid = await validateAndTouchSession(db, sessionToken);
  if (!valid) {
    return null;
  }
  const account = await loadAccountForSession(db, valid.accountId);
  if (!account || account.status === "deleted") {
    return null;
  }
  return {
    email: account.email,
    name: account.name,
    allowed: sessionAllowedForAccount(account),
  };
}
