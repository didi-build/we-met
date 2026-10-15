import type { BrandVariant } from "@/card-data/types";

/**
 * Render-time normalization for values read from D1. Unknown strings (including
 * `green`) map to mono for the v1 card redesign.
 */
export function normalizeBrandVariant(_raw: string): BrandVariant {
  return "mono";
}

/**
 * Load-file validation. V1 accepts only mono (variant may be omitted).
 */
export function parseCardVariantForLoad(raw: string): BrandVariant {
  if (raw === "mono") {
    return "mono";
  }
  if (raw === "green") {
    throw new Error(
      'Invalid variant: green (v1 public cards are mono only; use "mono" or omit variant)',
    );
  }
  throw new Error(`Invalid variant: ${raw} (use "mono" or omit variant)`);
}

export function isCardPalette(value: string): value is "mono" {
  return value === "mono";
}
