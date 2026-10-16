import type { AppApi } from "@/app-api/app-api";
import { createHttpApi } from "@/app-api/http-api";
import { createStubApi } from "@/app-api/stub-api";

function shouldUseHttpApi(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const env = process.env.NEXT_PUBLIC_WE_MET_ENV ?? "production";
  return env === "preview" || env === "local" || env === "production";
}

export function createRuntimeAppApi(search = ""): AppApi {
  if (!shouldUseHttpApi()) {
    return createStubApi(search);
  }
  return createHttpApi();
}
