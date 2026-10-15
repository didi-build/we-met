"use client";

import { CheckIcon } from "@/components/app/icons/AppIcons";
import type { SlugUiStatus } from "@/lib/app-editor/slug";

export function SlugStatusMessage({ status }: { status: SlugUiStatus }) {
  const s = status.status;
  if (s === "empty") {
    return <>Lowercase letters, numbers and hyphens.</>;
  }
  if (s === "typing" && status.status === "typing") {
    return (
      <>
        we-met.link/hi/<b>{status.value}</b>
      </>
    );
  }
  if (s === "checking") {
    return (
      <>
        <span className="ap-spin" aria-hidden />
        Checking…
      </>
    );
  }
  if (s === "available") {
    return (
      <>
        <span className="ap-icon" aria-hidden>
          <CheckIcon size={16} />
        </span>
        Available
      </>
    );
  }
  if (s === "mine") {
    return (
      <>
        <span className="ap-icon" aria-hidden>
          <CheckIcon size={16} />
        </span>
        This is your current link.
      </>
    );
  }
  if (s === "unknown") {
    return (
      <>Couldn&apos;t check this link. It will be checked again when you publish.</>
    );
  }
  return null;
}
