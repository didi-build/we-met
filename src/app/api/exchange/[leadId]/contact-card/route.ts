import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCardRepository } from "@/card-data/server";
import { isCardServingHost, readWeMetHostConfig } from "@/config/we-met";
import { clientIpFromHeaders } from "@/exchange/client-ip";
import { processExchangeContactCardDownload } from "@/exchange/process-exchange-contact-card";
import { createProcessExchangeContactCardDeps } from "@/exchange/runtime";

const MAX_TOKEN_LENGTH = 4096;

function readRouteLeadId(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) {
    return null;
  }
  return trimmed;
}

function readQueryToken(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("token");
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_LENGTH) {
    return null;
  }
  return trimmed;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const { leadId: rawLeadId } = await context.params;
  const routeLeadId = readRouteLeadId(rawLeadId);
  const token = readQueryToken(request);
  if (!routeLeadId || !token) {
    return new Response(null, { status: 404 });
  }

  const headerList = await headers();
  const hostname = headerList.get("host") ?? "localhost";
  const { env } = await getCloudflareContext({ async: true });
  const hostConfig = readWeMetHostConfig(env);

  if (!isCardServingHost(hostname, hostConfig)) {
    return new Response(null, { status: 404 });
  }

  const repo = await getCardRepository();
  const deps = await createProcessExchangeContactCardDeps(
    clientIpFromHeaders(headerList),
  );

  const result = await processExchangeContactCardDownload(
    { hostname, hostConfig, routeLeadId, token },
    repo,
    deps,
  );

  if (result.status !== "success") {
    return new Response(null, { status: 404 });
  }

  return new Response(result.vcardBody, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
