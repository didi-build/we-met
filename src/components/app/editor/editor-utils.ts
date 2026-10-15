import type { EditorCard } from "@/app-api/types";
import { useEffect, useState } from "react";

export function idFor(key: string): string {
  return key.replace(/\./g, "-");
}

export function getPath(card: EditorCard, path: string): string {
  const parts = path.split(".");
  let cur: unknown = card;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") {
      return "";
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return String(cur ?? "");
}

export function setPath(card: EditorCard, path: string, value: string): EditorCard {
  const next = structuredClone(card);
  const parts = path.split(".");
  let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const child = cur[key];
    if (child == null || typeof child !== "object") {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
  return next;
}

export function normalizeSlugInput(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "-");
}

export function useMediaWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}
