import type { WeMetHostConfig } from "@/config/we-met";
import { isCardServingHost } from "@/config/we-met";
import { isReservedHostname } from "@/card-data/reserved";
import type { CardRepository } from "@/card-data/repository";
import { isValidSlug } from "@/card-data/slug";
import type { CardRecord } from "@/card-data/types";

const HI_PREFIX = "/hi/";

export type LookupContext = {
  hostname: string;
  pathname: string;
};

export function parseHiSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith(HI_PREFIX)) {
    return null;
  }
  const rest = pathname.slice(HI_PREFIX.length);
  const slug = rest.split("/")[0];
  if (!slug) {
    return null;
  }
  return slug;
}

export async function lookupCard(
  ctx: LookupContext,
  repo: CardRepository,
  hostConfig: WeMetHostConfig,
): Promise<CardRecord | null> {
  const hostname = ctx.hostname.toLowerCase().split(":")[0] ?? "";

  if (!isReservedHostname(hostname)) {
    const byHost = await repo.getByHostname(hostname);
    if (byHost) {
      return byHost;
    }
  }

  const slug = parseHiSlugFromPath(ctx.pathname);
  if (!slug || !isValidSlug(slug)) {
    return null;
  }

  if (!isCardServingHost(hostname, hostConfig)) {
    return null;
  }

  return repo.getBySlug(slug);
}
