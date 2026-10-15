"use client";

import type { AppApi } from "@/app-api/app-api";
import { createContext, useContext, useMemo } from "react";
import { createRuntimeAppApi } from "@/app-api/runtime-api";

const AppApiContext = createContext<AppApi | null>(null);

export function AppApiProvider({
  api,
  children,
}: {
  api?: AppApi;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () =>
      api ??
      createRuntimeAppApi(typeof window !== "undefined" ? window.location.search : ""),
    [api],
  );
  return <AppApiContext.Provider value={value}>{children}</AppApiContext.Provider>;
}

export function useAppApi(): AppApi {
  const ctx = useContext(AppApiContext);
  if (!ctx) {
    throw new Error("useAppApi must be used within AppApiProvider");
  }
  return ctx;
}
