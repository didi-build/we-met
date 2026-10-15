import { THEME_STORAGE_KEY } from "@/lib/theme-storage-key";

/** V1 public cards always use the mono palette. */
export function buildHiCardThemeBootstrapScript(): string {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  return `(function(){try{var k=${storageKey};var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-palette","mono");}catch(e){}})();`;
}
