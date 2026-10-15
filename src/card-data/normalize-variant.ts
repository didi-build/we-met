import type { BrandVariant, CardPalette } from "@/card-data/types";

/** Stored in D1 `cards.variant` (CHECK allows only mono and green). */
const STORABLE_VARIANTS: BrandVariant[] = ["mono", "green"];

/** All generated palette CSS files (including blue for preview/tests). */
const CARD_PALETTES: CardPalette[] = ["mono", "green", "blue"];

/**
 * Render-time normalization for values read from D1. Unknown strings (including
 * `blue` if ever present) fall back to mono so the UI never crashes.
 */
export function normalizeBrandVariant(raw: string): BrandVariant {
  if (STORABLE_VARIANTS.includes(raw as BrandVariant)) {
    return raw as BrandVariant;
  }
  return "mono";
}

/**
 * Load-file validation. `blue` is in generated palette CSS but cannot be stored
 * until `cards.variant` CHECK is widened without rebuilding the table.
 */
export function parseCardVariantForLoad(raw: string): BrandVariant {
  if (raw === "blue") {
    throw new Error(
      'Invalid variant: blue (palette exists in CSS but is not storable in D1 yet; use "mono" or "green")',
    );
  }
  if (!STORABLE_VARIANTS.includes(raw as BrandVariant)) {
    throw new Error(`Invalid variant: ${raw} (use "mono" or "green")`);
  }
  return raw as BrandVariant;
}

export function isCardPalette(value: string): value is CardPalette {
  return CARD_PALETTES.includes(value as CardPalette);
}
