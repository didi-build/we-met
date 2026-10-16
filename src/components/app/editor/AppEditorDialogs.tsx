"use client";

import type { AppApi } from "@/app-api/app-api";
import type { AppSession } from "@/app-api/types";
import {
  CloseIcon,
  CopyIcon,
  ExternalIcon,
  GoogleGIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/app/icons/AppIcons";
import type { CropState } from "@/lib/app-editor/photo-crop";
import type { PointerEvent as ReactPointerEvent } from "react";

export type EditorDialog = "crop" | "published" | "session" | "confirm-publish" | null;

type AppEditorDialogsProps = {
  dialog: EditorDialog;
  closeDialog: () => void;
  cropOpenSrc: string | null;
  crop: CropState | null;
  cropStyle?: React.CSSProperties;
  cropStageRef: React.RefObject<HTMLDivElement | null>;
  cropImgRef: React.RefObject<HTMLImageElement | null>;
  paintCrop: (state: CropState) => void;
  panRef: React.MutableRefObject<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>;
  onCropImageLoad: () => void;
  useCroppedPhoto: () => void;
  pubTitle: string;
  pubUrl: string;
  copyLabel: string;
  copyPubUrl: () => void;
  signingIn: boolean;
  onSignIn: () => Promise<void>;
  api: AppApi;
  onSessionRestored: (session: AppSession) => void;
  scheduleSave: (ms: number) => void;
  publishSlug: string;
  onConfirmPublish: () => void;
  isPreviewEnv: boolean;
  previewSecret: string;
  onPreviewLogin: () => Promise<void>;
};

export function AppEditorDialogs({
  dialog,
  closeDialog,
  cropOpenSrc,
  crop,
  cropStyle,
  cropStageRef,
  cropImgRef,
  paintCrop,
  panRef,
  onCropImageLoad,
  useCroppedPhoto,
  pubTitle,
  pubUrl,
  copyLabel,
  copyPubUrl,
  signingIn,
  onSignIn,
  api,
  onSessionRestored,
  scheduleSave,
  publishSlug,
  onConfirmPublish,
  isPreviewEnv,
  previewSecret,
  onPreviewLogin,
}: AppEditorDialogsProps) {
  return (
    <>
      <div className="ap-dialog" hidden={dialog !== "crop"}>
        <div className="ap-scrim" onClick={closeDialog} />
        <div
          className="ap-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
        >
          <div className="ap-panel-head">
            <h2 className="ap-panel-title" id="crop-title">
              Crop your photo
            </h2>
            <button
              type="button"
              className="ap-iconbtn ap-close"
              aria-label="Close"
              onClick={closeDialog}
            >
              <span className="ap-icon" aria-hidden>
                <CloseIcon size={20} />
              </span>
            </button>
          </div>
          <div
            ref={cropStageRef}
            className="ap-crop"
            aria-label="Drag to move the photo"
            role="img"
            tabIndex={0}
            onPointerDown={(e: ReactPointerEvent) => {
              if (!crop) {
                return;
              }
              panRef.current = { x: e.clientX, y: e.clientY, ox: crop.x, oy: crop.y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e: ReactPointerEvent) => {
              if (!panRef.current || !crop) {
                return;
              }
              const pan = panRef.current;
              paintCrop({
                ...crop,
                x: pan.ox + e.clientX - pan.x,
                y: pan.oy + e.clientY - pan.y,
              });
            }}
            onPointerUp={() => {
              panRef.current = null;
            }}
            onKeyDown={(e) => {
              if (!crop) {
                return;
              }
              const d: Record<string, [number, number]> = {
                ArrowLeft: [-10, 0],
                ArrowRight: [10, 0],
                ArrowUp: [0, -10],
                ArrowDown: [0, 10],
              };
              const delta = d[e.key];
              if (!delta) {
                return;
              }
              e.preventDefault();
              paintCrop({ ...crop, x: crop.x + delta[0], y: crop.y + delta[1] });
            }}
          >
            {cropOpenSrc ? (
              <img
                ref={cropImgRef}
                src={cropOpenSrc}
                alt=""
                style={cropStyle}
                onLoad={onCropImageLoad}
              />
            ) : null}
            <span className="ap-crop-mask" aria-hidden />
            <span className="ap-crop-frame" aria-hidden />
          </div>
          <label className="ap-zoom">
            <span className="ap-icon" aria-hidden>
              <ZoomOutIcon size={20} />
            </span>
            <span className="ap-sr">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={crop?.z ?? 1}
              onChange={(e) => {
                if (!crop) {
                  return;
                }
                paintCrop({ ...crop, z: Number(e.target.value) });
              }}
            />
            <span className="ap-icon" aria-hidden>
              <ZoomInIcon size={20} />
            </span>
          </label>
          <p className="ap-crop-note">
            Drag to move. Your photo is saved square and shows as a circle on your card.
          </p>
          <div className="ap-panel-actions">
            <button
              type="button"
              className="ap-btn ap-btn-lg"
              onClick={useCroppedPhoto}
            >
              Use photo
            </button>
            <button
              type="button"
              className="ap-btn ap-btn-outline ap-btn-lg"
              onClick={closeDialog}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="ap-dialog" hidden={dialog !== "published"}>
        <div className="ap-scrim" onClick={closeDialog} />
        <div
          className="ap-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pub-title"
        >
          <div className="ap-panel-head">
            <h2 className="ap-panel-title" id="pub-title">
              {pubTitle}
            </h2>
            <button
              type="button"
              className="ap-iconbtn ap-close"
              aria-label="Close"
              onClick={closeDialog}
            >
              <span className="ap-icon" aria-hidden>
                <CloseIcon size={20} />
              </span>
            </button>
          </div>
          <p className="ap-panel-text">
            Share this link, or open your card to show its QR code.
          </p>
          <div className="ap-url">
            <span>{pubUrl.replace(/^https:\/\//, "")}</span>
            <button type="button" className="ap-btn ap-btn-sm" onClick={copyPubUrl}>
              <span className="ap-icon" aria-hidden>
                <CopyIcon size={18} />
              </span>
              <span>{copyLabel}</span>
            </button>
          </div>
          <div className="ap-panel-actions">
            <a
              className="ap-btn ap-btn-outline ap-btn-lg"
              href={pubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="ap-icon" aria-hidden>
                <ExternalIcon size={18} />
              </span>
              Open card
            </a>
          </div>
        </div>
      </div>

      <div className="ap-dialog" hidden={dialog !== "confirm-publish"}>
        <div className="ap-scrim" onClick={closeDialog} />
        <div
          className="ap-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-pub-title"
          aria-describedby="confirm-pub-text"
        >
          <div className="ap-panel-head">
            <h2 className="ap-panel-title" id="confirm-pub-title">
              Publish your card?
            </h2>
          </div>
          <p className="ap-panel-text" id="confirm-pub-text">
            This link can&apos;t be changed later:{" "}
            <strong>we-met.link/hi/{publishSlug || "your-name"}</strong>
          </p>
          <div className="ap-panel-actions">
            <button
              type="button"
              className="ap-btn ap-btn-lg"
              onClick={onConfirmPublish}
            >
              Publish
            </button>
            <button
              type="button"
              className="ap-btn ap-btn-outline ap-btn-lg"
              onClick={closeDialog}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="ap-dialog" hidden={dialog !== "session"}>
        <div className="ap-scrim" />
        <div
          className="ap-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sess-title"
          aria-describedby="sess-text"
        >
          <div className="ap-panel-head">
            <h2 className="ap-panel-title" id="sess-title">
              Sign in again to keep editing
            </h2>
          </div>
          <p className="ap-panel-text" id="sess-text">
            You were signed out. Your changes are kept on this page and will save once
            you&apos;re back.
          </p>
          <div className="ap-panel-actions">
            {isPreviewEnv ? (
              <button
                type="button"
                className="ap-btn ap-btn-lg"
                aria-busy={signingIn}
                disabled={signingIn || previewSecret.length === 0}
                onClick={async () => {
                  await onPreviewLogin();
                  const s = await api.getSession();
                  if (s) {
                    onSessionRestored(s);
                    closeDialog();
                    scheduleSave(0);
                  }
                }}
              >
                {signingIn ? "Signing in…" : "Preview sign-in"}
              </button>
            ) : (
              <button
                type="button"
                className="ap-google"
                aria-busy={signingIn}
                disabled={signingIn}
                onClick={async () => {
                  await onSignIn();
                  const s = await api.getSession();
                  if (s) {
                    onSessionRestored(s);
                    closeDialog();
                    scheduleSave(0);
                  }
                }}
              >
                {signingIn ? (
                  <span className="ap-spin" aria-hidden />
                ) : (
                  <span className="ap-icon" aria-hidden>
                    <GoogleGIcon size={20} />
                  </span>
                )}
                <span>{signingIn ? "Waiting for Google…" : "Sign in with Google"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
