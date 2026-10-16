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
  const cardRef = useRef(card);
  cardRef.current = card;

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

  const runSave = useCallback(async (): Promise<boolean> => {
    const mine = ++saveTickRef.current;
    const cardToSave = cardRef.current;
    setSaveUi("saving");
    try {
      await api.saveDraft(cardToSave);
      if (mine !== saveTickRef.current) {
        return true;
      }
      setSaveUi("saved");
      setPendingSave(false);
      return true;
    } catch (err) {
      if (mine !== saveTickRef.current) {
        return true;
      }
      if (err instanceof AppApiError && err.code === "unauthorized") {
        setSaveUi("error");
        onSessionExpired();
        return false;
      }
      setSaveUi("error");
      setPendingSave(true);
      return false;
    }
  }, [api, onSessionExpired]);

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

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setPendingSave(true);
    return runSave();
  }, [runSave]);

  const retrySave = useCallback(() => {
    scheduleSave(0);
  }, [scheduleSave]);

  return { saveUi, pendingSave, scheduleSave, retrySave, flushSave, cardRef };
}
