"use client";

import { useTheme } from "@/components/theme/ThemeProvider";

export function HiThemeSwitch() {
  const { theme, toggleTheme, themeAria } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={themeAria}
      onClick={toggleTheme}
      className="flex min-h-11 w-[52px] cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className="relative block h-[26px] w-11 rounded-pill bg-surface-2 shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors"
      >
        <span
          className="absolute left-[3px] top-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-ink text-bg transition-transform duration-200 ease-out"
          style={{ transform: isDark ? "translateX(18px)" : "translateX(0)" }}
        >
          {isDark ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}
