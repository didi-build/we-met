"use client";

import { APP_THEME_STORAGE_KEY } from "@/lib/app-theme-storage-key";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

function readTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "light";
  }
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") {
    return attr;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    const initial = stored === "light" || stored === "dark" ? stored : readTheme();
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  useEffect(() => {
    const onStorage = () => setTheme(readTheme());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const dark = theme === "dark";

  return (
    <div className="ap" data-theme={theme} data-dark={dark ? "true" : "false"}>
      {children}
    </div>
  );
}

export function useAppThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());

  useEffect(() => {
    const onStorage = () => setTheme(readTheme());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeMode = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, next);
    setTheme(next);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { theme, toggle, dark: theme === "dark" };
}
