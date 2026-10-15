"use client";

import type { AppApi } from "@/app-api/app-api";
import type { EditorCard } from "@/app-api/types";
import { slugFormatCheck, type SlugUiStatus } from "@/lib/app-editor/slug";
import { useCallback, useEffect, useRef, useState } from "react";

const SLUG_DEBOUNCE_MS = 400;

export function useSlugCheck(
  api: AppApi,
  published: EditorCard | null,
  initialSlug: string,
) {
  const [slugStatus, setSlugStatus] = useState<SlugUiStatus>({ status: "empty" });
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugSeqRef = useRef(0);

  const checkSlugNow = useCallback(
    async (value: string) => {
      const fmt = slugFormatCheck(value);
      if (fmt) {
        setSlugStatus({ status: "invalid", value, message: fmt });
        return;
      }
      if (published && value === published.slug) {
        setSlugStatus({ status: "mine", value });
        return;
      }
      const seq = ++slugSeqRef.current;
      setSlugStatus({ status: "checking", value });
      try {
        const result = await api.checkSlug(value);
        if (seq !== slugSeqRef.current) {
          return;
        }
        if (result.status === "available") {
          setSlugStatus({ status: "available", value });
        } else if (result.status === "reserved") {
          setSlugStatus({ status: "reserved", value });
        } else if (result.status === "taken") {
          setSlugStatus({ status: "taken", value });
        } else if (result.status === "invalid") {
          setSlugStatus({ status: "invalid", value, message: result.message });
        }
      } catch {
        if (seq !== slugSeqRef.current) {
          return;
        }
        setSlugStatus({ status: "unknown", value });
      }
    },
    [api, published],
  );

  const onSlugInput = useCallback(
    (value: string) => {
      if (slugTimerRef.current) {
        clearTimeout(slugTimerRef.current);
      }
      slugSeqRef.current += 1;
      if (!value) {
        setSlugStatus({ status: "empty" });
        return;
      }
      if (published && value === published.slug) {
        setSlugStatus({ status: "mine", value });
        return;
      }
      setSlugStatus({ status: "typing", value });
      slugTimerRef.current = setTimeout(() => {
        void checkSlugNow(value);
      }, SLUG_DEBOUNCE_MS);
    },
    [checkSlugNow, published],
  );

  useEffect(() => {
    if (!initialSlug) {
      setSlugStatus({ status: "empty" });
      return;
    }
    if (published && initialSlug === published.slug) {
      setSlugStatus({ status: "mine", value: initialSlug });
      return;
    }
    void checkSlugNow(initialSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap from server slug
  }, []);

  const markMine = useCallback((slug: string) => {
    setSlugStatus({ status: "mine", value: slug });
  }, []);

  return { slugStatus, onSlugInput, checkSlugNow, markMine, setSlugStatus };
}
