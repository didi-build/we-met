"use client";

import type { AppApi } from "@/app-api/app-api";
import { AppApiError, type EditorCard } from "@/app-api/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveUiState = "saved" | "saving" | "error";

export function useAutosave(
  api: AppApi,
  card: EditorCard,
  onSessionExpired: () => void,
) {
  const [saveUi, setSaveUi] = useState<SaveUiState>("saved");
  const [pendingSave, setPendingSave] = useState(false);
  const saveTickRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pendingSave && saveUi !== "error") {
        return;
      }
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingSave, saveUi]);

  const runSave = useCallback(async () => {
    const mine = ++saveTickRef.current;
    setSaveUi("saving");
    try {
      await api.saveDraft(card);
      if (mine !== saveTickRef.current) {
        return;
      }
      setSaveUi("saved");
      setPendingSave(false);
    } catch (err) {
      if (mine !== saveTickRef.current) {
        return;
      }
      if (err instanceof AppApiError && err.code === "unauthorized") {
        setSaveUi("error");
        onSessionExpired();
        return;
      }
      setSaveUi("error");
      setPendingSave(true);
    }
  }, [api, card, onSessionExpired]);

  const scheduleSave = useCallback(
    (ms: number) => {
      setPendingSave(true);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void runSave();
      }, ms);
    },
    [runSave],
  );

  const retrySave = useCallback(() => {
    scheduleSave(0);
  }, [scheduleSave]);

  return { saveUi, pendingSave, scheduleSave, retrySave };
}
