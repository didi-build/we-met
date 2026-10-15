import { isAppServingHost, readWeMetHostConfig } from "@/config/we-met";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CARD_HTML_CACHE_CONTROL = "private, max-age=0, must-revalidate";
const APP_COMING_SOON_PATH = "/app-coming-soon";

function readMiddlewareHostConfig() {
  return readWeMetHostConfig({
    WE_MET_BASE_URL: process.env.WE_MET_BASE_URL,
    WE_MET_PREVIEW_HOST_SUFFIX: process.env.WE_MET_PREVIEW_HOST_SUFFIX,
    WE_MET_ENV: process.env.WE_MET_ENV,
  });
}

function requestHostname(request: NextRequest): string {
  return (request.headers.get("host") ?? "localhost").toLowerCase().split(":")[0] ?? "";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostConfig = readMiddlewareHostConfig();
  const hostname = requestHostname(request);
  const onAppHost = isAppServingHost(hostname, hostConfig);

  if (onAppHost && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = APP_COMING_SOON_PATH;
    return NextResponse.rewrite(url);
  }

  if (pathname === APP_COMING_SOON_PATH && !onAppHost) {
    return new NextResponse(null, { status: 404 });
  }

  if (pathname.startsWith("/hi/")) {
    const response = NextResponse.next();
    if (!pathname.endsWith("/photo.jpg") && !pathname.endsWith("/contact.vcf")) {
      response.headers.set("Cache-Control", CARD_HTML_CACHE_CONTROL);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/app-coming-soon", "/hi/:path*"],
};
