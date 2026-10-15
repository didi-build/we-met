import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lookupCard } from "@/card-data/lookup";
import { getCardRepository } from "@/card-data/server";
import { isCardServingHost, readWeMetHostConfig } from "@/config/we-met";
import { processDetails } from "@/exchange/process-details";
import { createProcessDetailsDeps } from "@/exchange/runtime";
import { verifyDetailsToken } from "@/exchange/token";
import { parseDetailsBody } from "@/exchange/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = parseDetailsBody(body);
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

  const deps = await createProcessDetailsDeps();
  const verified = verifyDetailsToken(deps.tokenSecret, parsed.value.token);
  if (!verified.ok) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const repo = await getCardRepository();
  const card = await lookupCard(
    { hostname, pathname: `/hi/${verified.payload.cardSlug}` },
    repo,
    hostConfig,
  );
  const sinks = card ? await repo.listLeadSinks(card.id) : [];

  const result = await processDetails(parsed.value, card, sinks, deps);

  switch (result.status) {
    case "success":
      return Response.json({ ok: true }, { status: 200 });
    case "invalid_token":
    case "card_not_found":
      return Response.json({ error: "invalid_token" }, { status: 401 });
    default:
      return Response.json({ error: "server_error" }, { status: 500 });
  }
}
