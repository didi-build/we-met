import { isAppApiServingHost, resolveAppOrigin } from "@/config/app-api-host";
import { readWeMetHostConfig, type WeMetHostConfig } from "@/config/we-met";
import { clientIpFromHeaders } from "@/exchange/client-ip";

export const API_CACHE_CONTROL = "no-store";

export type AppAuthEnv = {
  WE_MET_BASE_URL?: string;
  WE_MET_PREVIEW_HOST_SUFFIX?: string;
  WE_MET_ENV?: string;
  WE_MET_APP_ORIGIN?: string;
};

export function readHostConfigFromEnv(env: AppAuthEnv): WeMetHostConfig {
  return readWeMetHostConfig(env);
}

export function requestHostname(headers: Headers): string {
  return (headers.get("host") ?? "localhost").toLowerCase();
}

export function apiNotFound(): Response {
  return new Response(null, { status: 404 });
}

export function apiJson(
  body: unknown,
  init: { status: number; headers?: Headers },
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", API_CACHE_CONTROL);
  return Response.json(body, { status: init.status, headers });
}

export function apiError(code: string, status: number): Response {
  return apiJson({ error: { code } }, { status });
}

export function withNoStoreHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", API_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function assertAppApiHost(hostname: string, config: WeMetHostConfig): boolean {
  return isAppApiServingHost(hostname, config);
}

export function checkOriginForMutation(
  request: Request,
  config: WeMetHostConfig,
  env: AppAuthEnv,
): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return false;
  }
  const expected = resolveAppOrigin(config, request.url, env);
  return origin === expected;
}

export function checkSecFetchSite(request: Request): boolean {
  const value = request.headers.get("sec-fetch-site");
  if (!value) {
    return true;
  }
  return value === "same-origin";
}

export function checkContentType(request: Request, expected: string): boolean {
  const header = request.headers.get("content-type");
  if (!header) {
    return false;
  }
  const mediaType = header.split(";")[0]?.trim().toLowerCase();
  return mediaType === expected;
}

export function guardMutationRequest(
  request: Request,
  config: WeMetHostConfig,
  env: AppAuthEnv,
  contentType: string,
): Response | null {
  if (!checkOriginForMutation(request, config, env)) {
    return apiError("forbidden", 403);
  }
  if (!checkSecFetchSite(request)) {
    return apiError("forbidden", 403);
  }
  if (!checkContentType(request, contentType)) {
    return apiError("forbidden", 403);
  }
  return null;
}

export function clientIp(headers: Headers): string {
  return clientIpFromHeaders(headers);
}
