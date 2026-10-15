"use client";

import "@/app/app-editor.css";
import { AppApiProvider } from "@/app-api/AppApiProvider";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { WeMetApp } from "@/components/app/WeMetApp";

export function AppShell() {
  return (
    <AppApiProvider>
      <AppThemeProvider>
        <WeMetApp />
      </AppThemeProvider>
    </AppApiProvider>
  );
}
