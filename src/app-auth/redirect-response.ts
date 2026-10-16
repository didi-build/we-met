import { API_CACHE_CONTROL } from "@/app-auth/guards";

export function redirectResponse(
  location: string,
  options?: { setCookies?: string[] },
): Response {
  const headers = new Headers();
  headers.set("Location", location);
  headers.set("cache-control", API_CACHE_CONTROL);
  for (const cookie of options?.setCookies ?? []) {
    headers.append("set-cookie", cookie);
  }
  return new Response(null, { status: 302, headers });
}
