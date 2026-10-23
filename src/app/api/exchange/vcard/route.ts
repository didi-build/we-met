import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCardRepository } from "@/card-data/server";
import { isCardServingHost, readWeMetHostConfig } from "@/config/we-met";
import { clientIpFromHeaders } from "@/exchange/client-ip";
import { readVCardRequestBody } from "@/exchange/parse-vcard-body";
import { processVCardDownload } from "@/exchange/process-vcard";
import { createProcessVCardDeps } from "@/exchange/runtime";

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  const parsed = await readVCardRequestBody(request);
  if (!parsed.ok) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const headerList = await headers();
  const hostname = headerList.get("host") ?? "localhost";
  const { env } = await getCloudflareContext({ async: true });
  const hostConfig = readWeMetHostConfig(env);
  if (!isCardServingHost(hostname, hostConfig)) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const clientIp = clientIpFromHeaders(headerList);
  const deps = await createProcessVCardDeps(clientIp);
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
      return Response.json({ error: "invalid_token" }, { status: 401 });
    case "card_not_found":
      return Response.json({ error: "card_not_found" }, { status: 404 });
    case "rate_limited":
      return Response.json({ error: "rate_limited" }, { status: 429 });
    case "server_error":
      return Response.json({ error: "server_error" }, { status: 500 });
    default:
      return Response.json({ error: "server_error" }, { status: 500 });
  }
}
