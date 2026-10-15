import type { BrandVariant } from "@/card-data/types";

const KNOWN: BrandVariant[] = ["mono", "green", "blue"];

export function normalizeBrandVariant(raw: string): BrandVariant {
  if (KNOWN.includes(raw as BrandVariant)) {
    return raw as BrandVariant;
  }
  return "mono";
}
