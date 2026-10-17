import { sessionAllowedForAccount, type AccountRow } from "@/app-auth/accounts";
import { sessionCookieValue } from "@/app-auth/cookies";
import { apiError, apiJson } from "@/app-auth/guards";
import {
  loadAccountForSession,
  validateAndTouchSession,
  type ValidatedSession,
} from "@/app-auth/sessions";
import type { EditorCard } from "@/app-api/types";
import type { D1Database } from "@cloudflare/workers-types";

export type CardRouteAuth =
  | {
      ok: true;
      account: AccountRow;
      session: ValidatedSession;
      sessionToken: string;
    }
  | { ok: false; response: Response };

export async function requireCardRouteAuth(
  db: D1Database,
  sessionToken: string | undefined,
): Promise<CardRouteAuth> {
  if (!sessionToken) {
    return { ok: false, response: apiError("unauthorized", 401) };
  }
  const session = await validateAndTouchSession(db, sessionToken);
  if (!session) {
    return { ok: false, response: apiError("unauthorized", 401) };
  }
  const account = await loadAccountForSession(db, session.accountId);
  if (!account || account.status === "deleted") {
    return { ok: false, response: apiError("unauthorized", 401) };
  }
  if (!sessionAllowedForAccount(account)) {
    return { ok: false, response: apiError("forbidden", 403) };
  }
  return {
    ok: true,
    account,
    session,
    sessionToken,
  };
}

export function withSessionCookie(
  response: Response,
  token: string,
  maxAgeSeconds: number,
): Response {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", sessionCookieValue(token, maxAgeSeconds));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function emptyEditorCard(): EditorCard {
  return {
    slug: "",
    name: "",
    role: "",
    phone: "",
    photo: "",
    about: [],
    services: [],
    links: { website: "", linkedin: "", github: "", instagram: "" },
    alternate: { url: "", label: "" },
  };
}

export function jsonOk(body: unknown, init?: { status?: number }): Response {
  return apiJson(body, { status: init?.status ?? 200 });
}
