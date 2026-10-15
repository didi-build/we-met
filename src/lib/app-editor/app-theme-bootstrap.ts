import { APP_THEME_STORAGE_KEY } from "@/lib/app-theme-storage-key";

/** Sets `data-theme` and mono palette before paint for the app editor preview route. */
export function buildAppThemeBootstrapScript(): string {
  const storageKey = JSON.stringify(APP_THEME_STORAGE_KEY);
  return `(function(){try{var k=${storageKey};var s=localStorage.getItem(k);var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-palette","mono");}catch(e){}})();`;
}
