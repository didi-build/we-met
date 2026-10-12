import { notFound } from "next/navigation";
import { isValidSlug } from "@/card-data/slug";
import { resolveCardForRequest } from "@/card-data/server";
import type { CardRecord } from "@/card-data/types";

export async function resolveHiCardPage(slug: string): Promise<CardRecord> {
  if (!isValidSlug(slug)) {
    notFound();
  }
  const card = await resolveCardForRequest(`/hi/${slug}`);
  if (!card || card.slug !== slug) {
    notFound();
  }
  if (card.variant !== "green") {
    notFound();
  }
  return card;
}
