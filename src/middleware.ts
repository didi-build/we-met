import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CARD_HTML_CACHE_CONTROL = "private, max-age=0, must-revalidate";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/hi/")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  if (!pathname.endsWith("/photo.jpg") && !pathname.endsWith("/contact.vcf")) {
    response.headers.set("Cache-Control", CARD_HTML_CACHE_CONTROL);
  }
  return response;
}

export const config = {
  matcher: ["/hi/:path*"],
};
