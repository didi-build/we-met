import { headers } from "next/headers";
import { lookupCard } from "@/card-data/lookup";
import { getCardRepository } from "@/card-data/server";
import { isCardServingHost, readWeMetHostConfig } from "@/config/we-met";
import { clientIpFromHeaders } from "@/exchange/client-ip";
import {
  exchangeOutcomeClassForLeadEmailDenial,
  writeExchangeOutcomeDataPoint,
  type ExchangeOutcomeStatusClass,
} from "@/exchange/exchange-outcome-analytics";
import { processExchange } from "@/exchange/process-exchange";
import { createProcessExchangeDeps } from "@/exchange/runtime";
import { parseExchangeBody } from "@/exchange/validation";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    writeExchangeOutcomeDataPoint(env, "4xx");
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = parseExchangeBody(body);
  if (!parsed.ok) {
    writeExchangeOutcomeDataPoint(env, "4xx");
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }
  if ("honeypot" in parsed) {
    // Honeypot fake 200 is excluded from the exchange acceptance SLI (monitoring plan section 4).
    return Response.json({ token: "" }, { status: 200 });
  }

  let outcomeRecorded = false;
  try {
    const headerList = await headers();
    const hostname = headerList.get("host") ?? "localhost";
    const hostConfig = readWeMetHostConfig(env);
    if (!isCardServingHost(hostname, hostConfig)) {
      writeExchangeOutcomeDataPoint(env, "4xx");
      outcomeRecorded = true;
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

    let response: Response;
    let outcomeClass: ExchangeOutcomeStatusClass;
    switch (result.status) {
      case "success":
        response = Response.json(result.body, { status: 200 });
        outcomeClass = "2xx";
        break;
      case "turnstile_failed":
        response = Response.json({ error: "turnstile_failed" }, { status: 403 });
        outcomeClass = "4xx";
        break;
      case "rate_limited":
        response = Response.json({ error: "rate_limited" }, { status: 429 });
        outcomeClass = "429";
        break;
      case "card_not_found":
        response = Response.json({ error: "card_not_found" }, { status: 404 });
        outcomeClass = "4xx";
        break;
      case "lead_email_unavailable":
        response = Response.json({ error: "lead_email_unavailable" }, { status: 503 });
        outcomeClass = exchangeOutcomeClassForLeadEmailDenial(result.reason);
        break;
      case "enqueue_failed":
        response = Response.json({ error: "server_error" }, { status: 500 });
        outcomeClass = "5xx";
        break;
      default:
        response = Response.json({ error: "server_error" }, { status: 500 });
        outcomeClass = "5xx";
    }
    writeExchangeOutcomeDataPoint(env, outcomeClass);
    outcomeRecorded = true;
    return response;
  } catch {
    if (!outcomeRecorded) {
      writeExchangeOutcomeDataPoint(env, "5xx");
    }
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
