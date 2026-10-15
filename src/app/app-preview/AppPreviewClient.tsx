"use client";

import "@/app/app-editor.css";
import { AppApiProvider } from "@/app-api/AppApiProvider";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { WeMetApp } from "@/components/app/WeMetApp";

export function AppPreviewClient() {
  return (
    <AppApiProvider>
      <AppThemeProvider>
        <p className="ap-prototype" role="status">
          Prototype: nothing is saved
        </p>
        <WeMetApp />
      </AppThemeProvider>
    </AppApiProvider>
  );
}
