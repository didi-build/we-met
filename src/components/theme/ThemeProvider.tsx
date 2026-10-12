"use client";

import { hiUiA11y } from "@/lib/hi-card/ui-a11y";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage-key";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
  themeAria: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readThemeFromDocument(): ThemeMode {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") {
    return attr;
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    setTheme(readThemeFromDocument());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
        const next = mq.matches ? "dark" : "light";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      themeAria:
        theme === "dark" ? hiUiA11y.themeSwitchToLight : hiUiA11y.themeSwitchToDark,
    }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
