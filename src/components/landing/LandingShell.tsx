"use client";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "@/components/landing/landing.css";
import type { ReactNode } from "react";

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className="lp">
        <div className="lp-glow" aria-hidden="true" />
        {children}
      </div>
    </ThemeProvider>
  );
}
