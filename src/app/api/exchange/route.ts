import { headers } from "next/headers";
import { lookupCard } from "@/card-data/lookup";
import { getCardRepository } from "@/card-data/server";
import { isCardServingHost, readWeMetHostConfig } from "@/config/we-met";
import { clientIpFromHeaders } from "@/exchange/client-ip";
import { processExchange } from "@/exchange/process-exchange";
import { createProcessExchangeDeps } from "@/exchange/runtime";
import { parseExchangeBody } from "@/exchange/validation";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = parseExchangeBody(body);
  if (!parsed.ok) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  if ("honeypot" in parsed) {
    return Response.json({ token: "" }, { status: 200 });
  }

  const headerList = await headers();
  const hostname = headerList.get("host") ?? "localhost";
  const { env } = await getCloudflareContext({ async: true });
  const hostConfig = readWeMetHostConfig(env);
  if (!isCardServingHost(hostname, hostConfig)) {
    return Response.json({ error: "card_not_found" }, { status: 404 });
  }

  const repo = await getCardRepository();
  const exchangeInput = parsed.value;
  const card = await lookupCard(
    { hostname, pathname: `/hi/${exchangeInput.slug}` },
    repo,
    hostConfig,
  );
  const sinks = card ? await repo.listLeadSinks(card.id) : [];

  const clientIp = clientIpFromHeaders(headerList);
  const deps = await createProcessExchangeDeps(clientIp);
  const result = await processExchange(exchangeInput, card, sinks, deps);

  switch (result.status) {
    case "success":
      return Response.json(result.body, { status: 200 });
    case "turnstile_failed":
      return Response.json({ error: "turnstile_failed" }, { status: 403 });
    case "rate_limited":
      return Response.json({ error: "rate_limited" }, { status: 429 });
    case "card_not_found":
      return Response.json({ error: "card_not_found" }, { status: 404 });
    case "enqueue_failed":
      return Response.json({ error: "server_error" }, { status: 500 });
    default:
      return Response.json({ error: "server_error" }, { status: 500 });
  }
}
