import type { AppApi } from "@/app-api/app-api";
import { createHttpAuthApi } from "@/app-api/http-auth";
import { createStubApi } from "@/app-api/stub-api";

function shouldUseHttpAuth(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.location.pathname.startsWith("/app-preview")) {
    return false;
  }
  const env = process.env.NEXT_PUBLIC_WE_MET_ENV ?? "production";
  return env === "preview" || env === "local" || env === "production";
}

export function createRuntimeAppApi(search = ""): AppApi {
  const stub = createStubApi(search);
  if (!shouldUseHttpAuth()) {
    return stub;
  }
  const auth = createHttpAuthApi();
  return {
    ...stub,
    getSession: auth.getSession,
    signIn: auth.signIn,
    signOut: auth.signOut,
  };
}
