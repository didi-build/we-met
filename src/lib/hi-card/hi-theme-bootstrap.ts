import { normalizeBrandVariant } from "@/card-data/normalize-variant";
import type { BrandVariant } from "@/card-data/types";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage-key";

export function hiCardPalette(variant: string): BrandVariant {
  return normalizeBrandVariant(variant);
}

export function buildHiCardThemeBootstrapScript(palette: BrandVariant): string {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  const paletteJson = JSON.stringify(palette);
  return `(function(){try{var k=${storageKey};var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-palette",${paletteJson});}catch(e){}})();`;
}
