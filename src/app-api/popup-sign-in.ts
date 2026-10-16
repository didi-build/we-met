import { AppApiError, type AppSession } from "@/app-api/types";

export const POPUP_SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;
export const POPUP_POLL_INTERVAL_MS = 400;

export type PopupSignInOutcome = "ok" | "failed" | "canceled" | "closed";

export async function waitForPopupSignIn(
  popup: Window,
  readSession: () => Promise<AppSession | null>,
  options?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<PopupSignInOutcome> {
  const timeoutMs = options?.timeoutMs ?? POPUP_SIGN_IN_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? POPUP_POLL_INTERVAL_MS;
  return await new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let settled = false;
    const finish = (outcome: PopupSignInOutcome) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("message", onMessage);
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      resolve(outcome);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as { type?: string; result?: string };
      if (data?.type !== "we-met-auth") {
        return;
      }
      if (data.result === "canceled") {
        finish("canceled");
        return;
      }
      if (data.result === "failed") {
        finish("failed");
        return;
      }
      if (data.result === "ok") {
        void readSession().then((session) => {
          finish(session ? "ok" : "failed");
        });
      }
    };

    window.addEventListener("message", onMessage);

    const pollTimer = window.setInterval(() => {
      if (popup.closed) {
        void readSession().then((session) => {
          finish(session ? "ok" : "closed");
        });
      }
    }, pollIntervalMs);

    const timeoutTimer = window.setTimeout(
      () => {
        finish("closed");
      },
      Math.max(0, deadline - Date.now()),
    );
  });
}

export async function signInWithPopupWindow(
  openPopup: () => Window | null,
  readSession: () => Promise<AppSession | null>,
): Promise<AppSession> {
  const popup = openPopup();
  if (!popup) {
    throw new AppApiError("failed");
  }

  const outcome = await waitForPopupSignIn(popup, readSession);
  if (outcome === "canceled") {
    throw new AppApiError("canceled");
  }
  if (outcome === "closed") {
    throw new AppApiError("closed");
  }
  if (outcome === "failed") {
    throw new AppApiError("failed");
  }

  const session = await readSession();
  if (!session) {
    throw new AppApiError("failed");
  }
  return session;
}
