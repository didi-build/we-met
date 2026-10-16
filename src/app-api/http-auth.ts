import { signInWithPopupWindow } from "@/app-api/popup-sign-in";
import { AppApiError, type AppSession } from "@/app-api/types";

export type SignInMode = "redirect" | "popup";

function isPreviewSignInClient(): boolean {
  return process.env.NEXT_PUBLIC_WE_MET_ENV === "preview";
}

async function readSession(): Promise<AppSession | null> {
  const response = await fetch("/api/app/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AppApiError("network");
  }
  const body = (await response.json()) as { session: AppSession | null };
  return body.session;
}

export function createHttpAuthApi() {
  return {
    async getSession(): Promise<AppSession | null> {
      return readSession();
    },

    async signIn(mode: SignInMode = "redirect"): Promise<AppSession> {
      if (isPreviewSignInClient()) {
        throw new AppApiError("failed");
      }
      if (mode === "redirect") {
        window.location.assign(`/api/auth/google/start?mode=redirect`);
        return new Promise(() => {
          /* redirect flow never resolves */
        });
      }

      return signInWithPopupWindow(
        () =>
          window.open(
            `/api/auth/google/start?mode=popup`,
            "we-met-google-sign-in",
            "width=480,height=640",
          ),
        readSession,
      );
    },

    async signOut(): Promise<void> {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: "{}",
      });
      if (!response.ok) {
        throw new AppApiError("network");
      }
    },

    async previewLogin(secret: string): Promise<AppSession> {
      const response = await fetch("/api/auth/preview-login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ secret }),
      });
      if (response.status === 404) {
        throw new AppApiError("failed");
      }
      if (response.status === 403) {
        throw new AppApiError("forbidden");
      }
      if (!response.ok) {
        throw new AppApiError("network");
      }
      const body = (await response.json()) as { session: AppSession };
      return body.session;
    },
  };
}
