import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createCardRepositoryFromD1 } from "@/card-data/get-repository";
import { lookupCard } from "@/card-data/lookup";
import type { CardRepository } from "@/card-data/repository";
import type { CardRecord } from "@/card-data/types";
import { readWeMetHostConfig } from "@/config/we-met";
import { headers } from "next/headers";

export async function getCardRepository(): Promise<CardRepository> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.WE_MET_DB) {
    throw new Error("WE_MET_DB binding is not configured");
  }
  return createCardRepositoryFromD1(env.WE_MET_DB);
}

export async function resolveCardForRequest(
  pathname: string,
): Promise<CardRecord | null> {
  const { env } = await getCloudflareContext({ async: true });
  const hostConfig = readWeMetHostConfig(env);
  const headerList = await headers();
  const hostname = headerList.get("host") ?? "localhost";
  const repo = await getCardRepository();
  return lookupCard({ hostname, pathname }, repo, hostConfig);
}

export async function resolveCardBySlug(slug: string): Promise<CardRecord | null> {
  const repo = await getCardRepository();
  return repo.getBySlug(slug);
}
