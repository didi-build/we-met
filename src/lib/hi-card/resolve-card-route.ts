import { notFound } from "next/navigation";
import { cache } from "react";
import { isValidSlug } from "@/card-data/slug";
import { resolveCardForRequest } from "@/card-data/server";
import type { CardRecord } from "@/card-data/types";

const loadHiCard = cache(async (slug: string): Promise<CardRecord | null> => {
  if (!isValidSlug(slug)) {
    return null;
  }
  const card = await resolveCardForRequest(`/hi/${slug}`);
  if (!card || card.slug !== slug) {
    return null;
  }
  return card;
});

export async function tryResolveHiCard(slug: string): Promise<CardRecord | null> {
  return loadHiCard(slug);
}

export async function resolveHiCardPage(slug: string): Promise<CardRecord> {
  const card = await loadHiCard(slug);
  if (!card) {
    notFound();
  }
  return card;
}
