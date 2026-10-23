import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCardRepository } from "@/card-data/server";
import { isCardServingHost, readWeMetHostConfig } from "@/config/we-met";
import { clientIpFromHeaders } from "@/exchange/client-ip";
import { readVCardRequestBody } from "@/exchange/parse-vcard-body";
import { processVCardDownload } from "@/exchange/process-vcard";
import { createProcessVCardDeps } from "@/exchange/runtime";
import {
  buildVcardFormRedirectLocation,
  vcardFormErrorToRedirectReason,
} from "@/exchange/vcard-form-redirect";
import { verifyDetailsToken } from "@/exchange/token";

function vcardFormRedirect(
  slug: string | undefined,
  reason: ReturnType<typeof vcardFormErrorToRedirectReason>,
): Response {
  const location = buildVcardFormRedirectLocation(slug, reason);
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}

function slugForRedirect(
  tokenSecret: string,
  token: string | undefined,
  formSlug?: string,
  nowSeconds?: number,
): string | undefined {
  if (token) {
    const verified = verifyDetailsToken(
      tokenSecret,
      token,
      nowSeconds ?? Math.floor(Date.now() / 1000),
    );
    if (verified.ok) {
      return verified.payload.cardSlug;
    }
  }
  return formSlug;
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  const parsed = await readVCardRequestBody(request);
  const isForm = parsed.isFormEncoded;

  if (!parsed.ok) {
    if (isForm) {
      return vcardFormRedirect(
        parsed.formSlug,
        vcardFormErrorToRedirectReason("invalid_input"),
      );
    }
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const headerList = await headers();
  const hostname = headerList.get("host") ?? "localhost";
  const { env } = await getCloudflareContext({ async: true });
  const hostConfig = readWeMetHostConfig(env);

  const deps = await createProcessVCardDeps(clientIpFromHeaders(headerList));
  const redirectSlug = slugForRedirect(
    deps.tokenSecret,
    parsed.value.token,
    parsed.value.formSlug,
    Math.floor(deps.now().getTime() / 1000),
  );

  if (!isCardServingHost(hostname, hostConfig)) {
    if (isForm) {
      return vcardFormRedirect(
        redirectSlug,
        vcardFormErrorToRedirectReason("invalid_host"),
      );
    }
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const repo = await getCardRepository();

  const result = await processVCardDownload(
    parsed.value,
    { hostname, hostConfig },
    repo,
    deps,
  );

  switch (result.status) {
    case "success":
      return new Response(result.vcardBody, {
        status: 200,
        headers: {
          "Content-Type": "text/vcard; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    case "invalid_token":
      if (isForm) {
        return vcardFormRedirect(
          slugForRedirect(
            deps.tokenSecret,
            parsed.value.token,
            parsed.value.formSlug,
            Math.floor(deps.now().getTime() / 1000),
          ),
          vcardFormErrorToRedirectReason("invalid_token"),
        );
      }
      return Response.json({ error: "invalid_token" }, { status: 401 });
    case "card_not_found":
      if (isForm) {
        return vcardFormRedirect(
          redirectSlug,
          vcardFormErrorToRedirectReason("card_not_found"),
        );
      }
      return Response.json({ error: "card_not_found" }, { status: 404 });
    case "rate_limited":
      if (isForm) {
        return vcardFormRedirect(
          redirectSlug,
          vcardFormErrorToRedirectReason("rate_limited"),
        );
      }
      return Response.json({ error: "rate_limited" }, { status: 429 });
    case "server_error":
      if (isForm) {
        return vcardFormRedirect(
          redirectSlug,
          vcardFormErrorToRedirectReason("server_error"),
        );
      }
      return Response.json({ error: "server_error" }, { status: 500 });
    default:
      if (isForm) {
        return vcardFormRedirect(
          redirectSlug,
          vcardFormErrorToRedirectReason("server_error"),
        );
      }
      return Response.json({ error: "server_error" }, { status: 500 });
  }
}
