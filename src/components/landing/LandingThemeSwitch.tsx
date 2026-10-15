"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { LandingIcon, MoonIcon, SunIcon } from "@/components/landing/LandingIcons";

export function LandingThemeSwitch() {
  const { theme, toggleTheme, themeAria } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="lp-toggle"
      role="switch"
      aria-checked={isDark}
      aria-label={themeAria}
      onClick={toggleTheme}
    >
      <span className="lp-track" aria-hidden>
        <span className="lp-knob">
          <LandingIcon className="lp-sun">
            <SunIcon size={13} />
          </LandingIcon>
          <LandingIcon className="lp-moon">
            <MoonIcon size={12} />
          </LandingIcon>
        </span>
      </span>
    </button>
  );
}
