"use client";

import { CheckIcon, ShareIcon } from "@/components/app/icons/AppIcons";
import type { EditorCard } from "@/app-api/types";

type AppEditorBottomBarProps = {
  barRef: React.RefObject<HTMLDivElement | null>;
  blockedOpen: boolean;
  blockedText: string;
  saveUi: "saved" | "saving" | "error";
  retrySave: () => void;
  published: EditorCard | null;
  openShare: () => void;
  publishState: "draft" | "changes" | "live";
  publishing: boolean;
  onPublish: () => void;
};

export function AppEditorBottomBar({
  barRef,
  blockedOpen,
  blockedText,
  saveUi,
  retrySave,
  published,
  openShare,
  publishState,
  publishing,
  onPublish,
}: AppEditorBottomBarProps) {
  return (
    <div className="ap-bar" ref={barRef}>
      <div className="ap-blocked" hidden={!blockedOpen}>
        <div className="ap-alert" role="alert">
          <span className="ap-alert-mark" aria-hidden>
            !
          </span>
          <span className="ap-alert-body">
            <span>{blockedText}</span>
          </span>
        </div>
      </div>
      <div className="ap-bar-in">
        <div className="ap-bar-status">
          <span
            className="ap-save"
            role="status"
            aria-live="polite"
            data-tone={saveUi === "error" ? "bad" : undefined}
          >
            {saveUi === "saving" ? (
              <>
                <span className="ap-spin" aria-hidden />
                Saving…
              </>
            ) : saveUi === "saved" ? (
              <>
                <span className="ap-icon" aria-hidden>
                  <CheckIcon size={14} />
                </span>
                Saved
              </>
            ) : (
              <>
                Couldn&apos;t save.{" "}
                <button type="button" className="ap-textbtn" onClick={retrySave}>
                  Retry
                </button>
              </>
            )}
          </span>
        </div>
        <div className="ap-bar-actions">
          <button
            type="button"
            className="ap-btn ap-btn-outline ap-btn-sm"
            hidden={!published}
            onClick={openShare}
          >
            <span className="ap-icon" aria-hidden>
              <ShareIcon size={18} />
            </span>
            Share card
          </button>
          <button
            type="button"
            className="ap-btn"
            data-state={publishState}
            aria-busy={publishing}
            disabled={publishState === "live" || publishing}
            aria-label={
              publishState === "live"
                ? "Published, nothing new to publish"
                : publishState === "changes"
                  ? "Publish changes"
                  : "Publish"
            }
            onClick={onPublish}
          >
            {publishing ? (
              <>
                <span className="ap-spin" aria-hidden />
                Publishing…
              </>
            ) : publishState === "live" ? (
              <>
                <span className="ap-btn-dot" aria-hidden />
                Published
              </>
            ) : publishState === "changes" ? (
              "Publish changes"
            ) : (
              "Publish"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
