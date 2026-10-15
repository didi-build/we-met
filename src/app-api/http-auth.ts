import { AppApiError, type AppSession } from "@/app-api/types";

export type SignInMode = "redirect" | "popup";

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

function waitForPopupAuth(): Promise<"ok" | "failed" | "canceled"> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as { type?: string; result?: string };
      if (data?.type !== "we-met-auth") {
        return;
      }
      window.removeEventListener("message", onMessage);
      if (
        data.result === "ok" ||
        data.result === "failed" ||
        data.result === "canceled"
      ) {
        resolve(data.result);
        return;
      }
      resolve("failed");
    };
    window.addEventListener("message", onMessage);
  });
}

export function createHttpAuthApi() {
  return {
    async getSession(): Promise<AppSession | null> {
      return readSession();
    },

    async signIn(mode: SignInMode = "redirect"): Promise<AppSession> {
      if (mode === "redirect") {
        window.location.assign(`/api/auth/google/start?mode=redirect`);
        return new Promise(() => {
          /* redirect flow never resolves */
        });
      }

      const popup = window.open(
        `/api/auth/google/start?mode=popup`,
        "we-met-google-sign-in",
        "width=480,height=640",
      );
      if (!popup) {
        throw new AppApiError("failed");
      }

      const result = await waitForPopupAuth();
      if (result === "canceled") {
        throw new AppApiError("canceled");
      }
      if (result === "failed") {
        throw new AppApiError("failed");
      }

      const session = await readSession();
      if (!session) {
        throw new AppApiError("failed");
      }
      return session;
    },

    async signOut(): Promise<void> {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
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
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ secret }),
      });
      if (response.status === 404) {
        throw new AppApiError("failed");
      }
      if (!response.ok) {
        throw new AppApiError("network");
      }
      const body = (await response.json()) as { session: AppSession };
      return body.session;
    },
  };
}
