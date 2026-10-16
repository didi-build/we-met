"use client";

import { useAppApi } from "@/app-api/AppApiProvider";
import { AppApiError, type AppSession, type EditorCard } from "@/app-api/types";
import { CARD_FIELD_LIMITS } from "@/card-data/limits";
import { AppEditorBottomBar } from "@/components/app/editor/AppEditorBottomBar";
import { AppCardPreview } from "@/components/app/editor/AppCardPreview";
import { AppEditorDialogs } from "@/components/app/editor/AppEditorDialogs";
import { SlugStatusMessage } from "@/components/app/editor/SlugStatusMessage";
import {
  getPath,
  idFor,
  normalizeSlugInput,
  setPath,
  useMediaWide,
} from "@/components/app/editor/editor-utils";
import { useAppThemeToggle } from "@/components/app/AppThemeProvider";
import { CharCount, FieldError } from "@/components/app/FieldControls";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CameraIcon,
  ChevronDownIcon,
  GithubIcon,
  InstagramIcon,
  LinkIcon,
  LinkedinIcon,
  LockIcon,
  MailIcon,
  PlusIcon,
  TrashIcon,
  WebsiteIcon,
} from "@/components/app/icons/AppIcons";
import {
  clampCrop,
  cropBaseScale,
  type CropState,
  renderCroppedPhotoJpeg,
} from "@/lib/app-editor/photo-crop";
import { useAutosave } from "@/lib/app-editor/hooks/useAutosave";
import {
  publishBlockerSentence,
  publishBlockers,
  usePublish,
} from "@/lib/app-editor/hooks/usePublish";
import { useSlugCheck } from "@/lib/app-editor/hooks/useSlugCheck";
import { allFieldKeys, fieldError } from "@/lib/app-editor/validation";
import { cardInitials } from "@/lib/hi-card/card-content";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type EditorTab = "edit" | "preview";

type AppCardEditorProps = {
  session: AppSession;
  initialDraft: EditorCard;
  initialPublished: EditorCard | null;
  onSessionRestored: (session: AppSession) => void;
  onSignIn: () => Promise<void>;
  onPreviewLogin?: () => Promise<void>;
  previewSecret?: string;
  isPreviewEnv?: boolean;
  signingIn: boolean;
};

export function AppCardEditor({
  session,
  initialDraft,
  initialPublished,
  onSessionRestored,
  onSignIn,
  onPreviewLogin,
  previewSecret = "",
  isPreviewEnv = false,
  signingIn,
}: AppCardEditorProps) {
  const api = useAppApi();
  const { theme: appTheme } = useAppThemeToggle();
  const wide = useMediaWide();
  const announceId = useId();

  const [card, setCard] = useState<EditorCard>(initialDraft);
  const [published, setPublished] = useState<EditorCard | null>(initialPublished);
  const [triedPublish, setTriedPublish] = useState(false);
  const [tab, setTab] = useState<EditorTab>("edit");
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedText, setBlockedText] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [announce, setAnnounce] = useState("");

  const [dialog, setDialog] = useState<
    "crop" | "published" | "session" | "confirm-publish" | null
  >(null);
  const [pubUrl, setPubUrl] = useState("");
  const [pubTitle, setPubTitle] = useState("Your card is live");
  const [copyLabel, setCopyLabel] = useState("Copy link");

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [cropOpenSrc, setCropOpenSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const cropStageRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);

  const onSessionExpired = useCallback(() => {
    setDialog("session");
    dialogOpenerRef.current = document.activeElement as HTMLElement;
  }, []);

  const { saveUi, scheduleSave, retrySave, flushSave, cardRef } = useAutosave(
    api,
    card,
    onSessionExpired,
  );
  const { slugStatus, onSlugInput, markMine } = useSlugCheck(api, published, card.slug);

  const fieldKeys = useMemo(() => allFieldKeys(card), [card]);

  const errFor = useCallback(
    (key: string) => fieldError(key, card, slugStatus, triedPublish),
    [card, slugStatus, triedPublish],
  );

  const fitBar = useCallback(() => {
    requestAnimationFrame(() => {
      const bar = barRef.current;
      const ed = editorRef.current;
      if (bar && ed) {
        ed.style.paddingBottom = `${bar.offsetHeight + 32}px`;
      }
    });
  }, []);

  const onCardChange = useCallback(
    (next: EditorCard) => {
      setCard(next);
      scheduleSave(800);
    },
    [scheduleSave],
  );

  const updateField = useCallback(
    (path: string, value: string) => {
      if (path === "slug") {
        const clean = normalizeSlugInput(value);
        const next = { ...card, slug: clean };
        setCard(next);
        onSlugInput(clean);
        scheduleSave(800);
        return;
      }
      const next = setPath(card, path, value);
      onCardChange(next);
    },
    [card, onCardChange, onSlugInput, scheduleSave],
  );

  const blockers = useCallback(
    () =>
      publishBlockers({
        name: card.name,
        slug: card.slug,
        slugStatus: slugStatus.status,
        fieldKeys,
        fieldError: errFor,
      }),
    [card.name, card.slug, errFor, fieldKeys, slugStatus.status],
  );

  const {
    publishing,
    publishState,
    handlePublish: runPublish,
  } = usePublish(api, card, published, blockers, flushSave);

  useEffect(() => {
    fitBar();
  }, [blockedOpen, fitBar, publishState, saveUi]);

  useEffect(() => {
    const onResize = () => fitBar();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitBar]);

  const openDialog = useCallback(
    (
      name: "crop" | "published" | "session" | "confirm-publish",
      opener?: HTMLElement,
    ) => {
      dialogOpenerRef.current = opener ?? (document.activeElement as HTMLElement);
      setDialog(name);
      document.body.style.overflow = "hidden";
    },
    [],
  );

  const closeDialog = useCallback(() => {
    setDialog(null);
    document.body.style.overflow = "";
    dialogOpenerRef.current?.focus({ preventScroll: true });
    if (cropOpenSrc) {
      URL.revokeObjectURL(cropOpenSrc);
      setCropOpenSrc(null);
    }
  }, [cropOpenSrc]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!dialog) {
        return;
      }
      if (e.key === "Escape" && dialog !== "session") {
        e.preventDefault();
        closeDialog();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDialog, dialog]);

  const paintCrop = useCallback((state: CropState) => {
    const clamped = clampCrop(state);
    setCrop(clamped);
  }, []);

  const onCropImageLoad = useCallback(() => {
    const img = cropImgRef.current;
    const stage = cropStageRef.current;
    if (!img || !stage) {
      return;
    }
    const S = stage.clientWidth;
    const base = cropBaseScale(S, img.naturalWidth, img.naturalHeight);
    paintCrop({
      x: 0,
      y: 0,
      z: 1,
      base,
      w: img.naturalWidth,
      h: img.naturalHeight,
      S,
    });
  }, [paintCrop]);

  const openCrop = useCallback(
    (src: string) => {
      setCropOpenSrc(src);
      openDialog("crop");
    },
    [openDialog],
  );

  const onPhotoFile = useCallback(
    (file: File | undefined) => {
      if (!file) {
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setPhotoError("Use a JPG, PNG or WebP image.");
        return;
      }
      if (file.size > CARD_FIELD_LIMITS.photoMaxBytes) {
        setPhotoError("That photo is over 5 MB. Choose a smaller one.");
        return;
      }
      setPhotoError("");
      openCrop(URL.createObjectURL(file));
    },
    [openCrop],
  );

  const useCroppedPhoto = useCallback(async () => {
    const img = cropImgRef.current;
    if (!img || !crop) {
      return;
    }
    closeDialog();
    setPhotoUploading(true);
    setAnnounce("Uploading photo.");
    try {
      const blob = await renderCroppedPhotoJpeg(img, crop);
      const { url } = await api.uploadPhoto(blob);
      const next = { ...cardRef.current, photo: url };
      onCardChange(next);
      setAnnounce("Photo added.");
    } catch (err) {
      if (err instanceof AppApiError) {
        if (err.code === "rate-limited") {
          setPhotoError("You've reached the photo upload limit. Try again later.");
        } else if (err.code === "invalid-photo") {
          setPhotoError(
            "That image could not be used. Use a square JPG, PNG, or WebP between 128×128 and 4096×4096 pixels.",
          );
        } else if (err.code === "unavailable") {
          setPhotoError(
            "The upload didn't finish. Check your connection and try again.",
          );
        } else {
          setPhotoError(
            "The upload didn't finish. Check your connection and try again.",
          );
        }
      } else {
        setPhotoError("The upload didn't finish. Check your connection and try again.");
      }
    } finally {
      setPhotoUploading(false);
    }
  }, [api, cardRef, closeDialog, crop, onCardChange]);

  const runPublishFlow = useCallback(async () => {
    setTriedPublish(true);
    const result = await runPublish(
      (url) => {
        setBlockedOpen(false);
        setPublished(structuredClone(card));
        markMine(card.slug);
        setPubUrl(url);
        setPubTitle("Your card is live");
        setCopyLabel("Copy link");
        openDialog("published");
        setAnnounce("Your card is live.");
      },
      (message) => {
        setBlockedOpen(true);
        setBlockedText(message);
        fitBar();
        setTab("edit");
      },
    );
    if (result.blocked) {
      setTab("edit");
    }
  }, [card, fitBar, markMine, openDialog, runPublish]);

  const handlePublish = useCallback(() => {
    setTriedPublish(true);
    const b = blockers();
    if (b.length) {
      setBlockedOpen(true);
      setBlockedText(publishBlockerSentence(b));
      fitBar();
      setTab("edit");
      return;
    }
    if (!published) {
      openDialog("confirm-publish");
      return;
    }
    void runPublishFlow();
  }, [blockers, fitBar, openDialog, published, runPublishFlow]);

  const openShare = useCallback(() => {
    if (!published) {
      return;
    }
    const url = `https://we-met.link/hi/${published.slug}`;
    setPubUrl(url);
    setPubTitle("Share your card");
    setCopyLabel("Copy link");
    openDialog("published");
  }, [openDialog, published]);

  const copyPubUrl = useCallback(() => {
    const done = () => {
      setCopyLabel("Copied");
      setAnnounce("Link copied.");
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pubUrl).then(done, done);
    } else {
      done();
    }
  }, [pubUrl]);

  const slugLocked = Boolean(published);

  const slugStatusTone =
    slugStatus.status === "available" || slugStatus.status === "mine" ? "ok" : "";

  const showSlugHelp =
    slugStatus.status !== "invalid" &&
    slugStatus.status !== "reserved" &&
    slugStatus.status !== "taken";

  const initials = cardInitials(card.name);

  const renderField = (key: string, children: ReactNode, invalid?: boolean) => (
    <div
      className="ap-field"
      data-field={key}
      data-invalid={invalid ? "true" : "false"}
    >
      {children}
    </div>
  );

  const secCollapsed = (id: string) => (!wide ? collapsed[id] === true : false);

  const toggleSec = (id: string) => {
    if (wide) {
      return;
    }
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  };

  const cropStyle =
    crop && cropImgRef.current
      ? {
          width: crop.w * crop.base * crop.z,
          height: crop.h * crop.base * crop.z,
          transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
        }
      : undefined;

  return (
    <div data-view="editor">
      <div className="ap-tabs">
        <div className="ap-seg" role="tablist" aria-label="Editor view">
          <button
            type="button"
            role="tab"
            id="tab-edit"
            aria-selected={tab === "edit"}
            aria-controls="ap-form"
            data-tab="edit"
            tabIndex={tab === "edit" ? 0 : -1}
            onClick={() => setTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            id="tab-preview"
            aria-selected={tab === "preview"}
            aria-controls="ap-preview"
            data-tab="preview"
            tabIndex={tab === "preview" ? 0 : -1}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="ap-editor" data-editor data-tab={tab} ref={editorRef}>
        <form
          className="ap-form"
          id="ap-form"
          role="tabpanel"
          aria-labelledby="tab-edit"
          noValidate
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="ap-form-head">
            <h1 className="ap-form-title">Your card</h1>
            <p className="ap-form-sub">
              Changes save as you type. Your public card only changes when you publish.
            </p>
          </div>

          <section
            className="ap-sec"
            aria-labelledby="sec-link"
            data-sec
            data-collapsed={secCollapsed("link") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-link">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("link")}
                  aria-controls="body-link"
                  onClick={() => toggleSec("link")}
                >
                  <span className="ap-sec-name">Your link</span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
            </div>
            <div className="ap-sec-body" id="body-link">
              {renderField(
                "slug",
                <>
                  <div
                    className="ap-box ap-box-action"
                    data-slug-box
                    data-locked={slugLocked ? "true" : "false"}
                  >
                    <label className="ap-label" htmlFor="f-slug">
                      Card address
                    </label>
                    <span className="ap-prefixed">
                      <span className="ap-prefix" aria-hidden>
                        we-met.link/hi/
                      </span>
                      <input
                        className="ap-input"
                        id="f-slug"
                        value={card.slug}
                        readOnly={slugLocked}
                        tabIndex={slugLocked ? -1 : 0}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="url"
                        placeholder="your-name"
                        aria-describedby="f-slug-status f-slug-err"
                        aria-invalid={Boolean(errFor("slug"))}
                        onChange={(e) => updateField("slug", e.target.value)}
                      />
                    </span>
                    {slugLocked ? (
                      <span className="ap-icon ap-box-btn" aria-hidden>
                        <LockIcon size={18} />
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="ap-slug-status"
                    id="f-slug-status"
                    role="status"
                    aria-live="polite"
                    data-tone={slugStatusTone}
                    hidden={!showSlugHelp}
                  >
                    <SlugStatusMessage status={slugStatus} />
                  </p>
                  <div className="ap-meta">
                    <FieldError message={errFor("slug")} id="f-slug-err" />
                  </div>
                </>,
                Boolean(errFor("slug")),
              )}
            </div>
          </section>

          <section
            className="ap-sec"
            aria-labelledby="sec-profile"
            data-sec
            data-collapsed={secCollapsed("profile") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-profile">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("profile")}
                  aria-controls="body-profile"
                  onClick={() => toggleSec("profile")}
                >
                  <span className="ap-sec-name">Profile</span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
            </div>
            <div className="ap-sec-body" id="body-profile">
              {renderField(
                "photo",
                <>
                  <div className="ap-photo">
                    <div className="ap-photo-img">
                      {card.photo ? <img src={card.photo} alt="" /> : null}
                      <span
                        className="ap-photo-initials"
                        aria-hidden
                        hidden={Boolean(card.photo)}
                      >
                        {initials}
                      </span>
                      <span className="ap-photo-busy" hidden={!photoUploading}>
                        <span className="ap-spin" aria-hidden />
                        <span className="ap-sr">Uploading photo</span>
                      </span>
                    </div>
                    <div className="ap-photo-actions">
                      <button
                        type="button"
                        className="ap-btn ap-btn-outline ap-btn-sm"
                        disabled={photoUploading}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        <span className="ap-icon" aria-hidden>
                          <CameraIcon size={18} />
                        </span>
                        <span>
                          {photoUploading
                            ? "Uploading…"
                            : card.photo
                              ? "Change photo"
                              : "Add photo"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ap-textbtn"
                        hidden={!card.photo}
                        disabled={photoUploading}
                        onClick={() => {
                          void (async () => {
                            try {
                              await api.deletePhoto();
                              onCardChange({ ...cardRef.current, photo: "" });
                              setPhotoError("");
                              setAnnounce("Photo removed.");
                            } catch {
                              setPhotoError(
                                "The upload didn't finish. Check your connection and try again.",
                              );
                            }
                          })();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => onPhotoFile(e.target.files?.[0])}
                  />
                  <div className="ap-meta">
                    {photoError ? (
                      <p className="ap-err" id="f-photo-err" role="alert">
                        {photoError}
                      </p>
                    ) : (
                      <p className="ap-err" id="f-photo-err" hidden />
                    )}
                    <p className="ap-help" hidden={Boolean(photoError)}>
                      JPG, PNG or WebP, up to 5 MB. Without a photo, your card shows
                      your initials.
                    </p>
                  </div>
                </>,
                Boolean(photoError),
              )}

              {renderField(
                "name",
                <>
                  <label className="ap-box" htmlFor="f-name">
                    <span className="ap-label">Name</span>
                    <input
                      className="ap-input"
                      id="f-name"
                      value={card.name}
                      autoComplete="name"
                      aria-describedby="f-name-err f-name-count"
                      aria-invalid={Boolean(errFor("name"))}
                      onChange={(e) => updateField("name", e.target.value)}
                    />
                  </label>
                  <div className="ap-meta">
                    <FieldError message={errFor("name")} id="f-name-err" />
                    <CharCount
                      fieldKey="name"
                      length={card.name.length}
                      id="f-name-count"
                    />
                  </div>
                </>,
                Boolean(errFor("name")),
              )}

              {renderField(
                "role",
                <>
                  <label className="ap-box" htmlFor="f-role">
                    <span className="ap-label">
                      Role <span className="ap-label-opt">(optional)</span>
                    </span>
                    <input
                      className="ap-input"
                      id="f-role"
                      value={card.role}
                      autoComplete="organization-title"
                      placeholder="What you do, in a few words"
                      aria-describedby="f-role-err f-role-count"
                      aria-invalid={Boolean(errFor("role"))}
                      onChange={(e) => updateField("role", e.target.value)}
                    />
                  </label>
                  <div className="ap-meta">
                    <FieldError message={errFor("role")} id="f-role-err" />
                    <CharCount
                      fieldKey="role"
                      length={card.role.length}
                      id="f-role-count"
                    />
                  </div>
                </>,
                Boolean(errFor("role")),
              )}
            </div>
          </section>

          <section
            className="ap-sec"
            aria-labelledby="sec-about"
            data-sec
            data-collapsed={secCollapsed("about") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-about">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("about")}
                  aria-controls="body-about"
                  onClick={() => toggleSec("about")}
                >
                  <span className="ap-sec-name">About me</span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
              <p className="ap-sec-sub">
                Up to {CARD_FIELD_LIMITS.aboutParagraphs} short paragraphs. The first
                one shows; the rest open with Show more.
              </p>
            </div>
            <div className="ap-sec-body" id="body-about">
              <ol className="ap-items">
                {card.about.map((para, i) => {
                  const key = `about.${i}`;
                  return (
                    <li className="ap-item" key={key}>
                      {renderField(
                        key,
                        <>
                          <label className="ap-box" htmlFor={`f-${idFor(key)}`}>
                            <span className="ap-label">Paragraph {i + 1}</span>
                            <textarea
                              className="ap-input"
                              id={`f-${idFor(key)}`}
                              rows={3}
                              value={para}
                              aria-describedby={`e-${idFor(key)} c-${idFor(key)}`}
                              aria-invalid={Boolean(errFor(key))}
                              onChange={(e) => {
                                const next = structuredClone(card);
                                next.about[i] = e.target.value;
                                onCardChange(next);
                              }}
                            />
                          </label>
                          <div className="ap-meta">
                            <FieldError message={errFor(key)} id={`e-${idFor(key)}`} />
                            <CharCount
                              fieldKey={key}
                              length={para.length}
                              id={`c-${idFor(key)}`}
                            />
                          </div>
                        </>,
                        Boolean(errFor(key)),
                      )}
                      <button
                        type="button"
                        className="ap-textbtn"
                        style={{ alignSelf: "flex-start" }}
                        onClick={() => {
                          const next = structuredClone(card);
                          next.about.splice(i, 1);
                          onCardChange(next);
                          setAnnounce("Paragraph removed.");
                        }}
                      >
                        <span className="ap-icon" aria-hidden>
                          <TrashIcon size={16} />
                        </span>
                        Remove paragraph
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                className="ap-textbtn ap-add"
                hidden={card.about.length >= CARD_FIELD_LIMITS.aboutParagraphs}
                onClick={() => onCardChange({ ...card, about: [...card.about, ""] })}
              >
                <span className="ap-icon" aria-hidden>
                  <PlusIcon size={16} />
                </span>
                Add paragraph
              </button>
              <p
                className="ap-limit"
                hidden={card.about.length < CARD_FIELD_LIMITS.aboutParagraphs}
              >
                That&apos;s the maximum of {CARD_FIELD_LIMITS.aboutParagraphs}{" "}
                paragraphs.
              </p>
            </div>
          </section>

          <section
            className="ap-sec"
            aria-labelledby="sec-services"
            data-sec
            data-collapsed={secCollapsed("services") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-services">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("services")}
                  aria-controls="body-services"
                  onClick={() => toggleSec("services")}
                >
                  <span className="ap-sec-name">What I do</span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
              <p className="ap-sec-sub">
                Up to {CARD_FIELD_LIMITS.services}. Each shows as a chip; tapping it
                shows the description.
              </p>
            </div>
            <div className="ap-sec-body" id="body-services">
              <ol className="ap-items">
                {card.services.map((svc, i) => {
                  const titleKey = `services.${i}.title`;
                  const descKey = `services.${i}.description`;
                  const label = svc.title.trim() || `service ${i + 1}`;
                  return (
                    <li className="ap-item ap-item-svc" key={`svc-${i}`}>
                      <div className="ap-item-bar">
                        <span className="ap-item-label">Service {i + 1}</span>
                        <span className="ap-item-tools">
                          <button
                            type="button"
                            className="ap-iconbtn"
                            disabled={i === 0}
                            aria-label={`Move ${label} up`}
                            onClick={() => {
                              const next = structuredClone(card);
                              const tmp = next.services[i]!;
                              next.services[i] = next.services[i - 1]!;
                              next.services[i - 1] = tmp;
                              onCardChange(next);
                              setAnnounce(`Moved to position ${i}.`);
                            }}
                          >
                            <span className="ap-icon" aria-hidden>
                              <ArrowUpIcon size={18} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className="ap-iconbtn"
                            disabled={i === card.services.length - 1}
                            aria-label={`Move ${label} down`}
                            onClick={() => {
                              const next = structuredClone(card);
                              const tmp = next.services[i]!;
                              next.services[i] = next.services[i + 1]!;
                              next.services[i + 1] = tmp;
                              onCardChange(next);
                              setAnnounce(`Moved to position ${i + 2}.`);
                            }}
                          >
                            <span className="ap-icon" aria-hidden>
                              <ArrowDownIcon size={18} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className="ap-iconbtn"
                            aria-label={`Delete ${label}`}
                            onClick={() => {
                              const next = structuredClone(card);
                              next.services.splice(i, 1);
                              onCardChange(next);
                              setAnnounce("Service deleted.");
                            }}
                          >
                            <span className="ap-icon" aria-hidden>
                              <TrashIcon size={18} />
                            </span>
                          </button>
                        </span>
                      </div>
                      {renderField(
                        titleKey,
                        <>
                          <label className="ap-box" htmlFor={`f-${idFor(titleKey)}`}>
                            <span className="ap-label">Title</span>
                            <input
                              className="ap-input"
                              id={`f-${idFor(titleKey)}`}
                              placeholder="System audit"
                              value={svc.title}
                              aria-describedby={`e-${idFor(titleKey)} c-${idFor(titleKey)}`}
                              aria-invalid={Boolean(errFor(titleKey))}
                              onChange={(e) => updateField(titleKey, e.target.value)}
                            />
                          </label>
                          <div className="ap-meta">
                            <FieldError
                              message={errFor(titleKey)}
                              id={`e-${idFor(titleKey)}`}
                            />
                            <CharCount
                              fieldKey={titleKey}
                              length={svc.title.length}
                              id={`c-${idFor(titleKey)}`}
                            />
                          </div>
                        </>,
                        Boolean(errFor(titleKey)),
                      )}
                      {renderField(
                        descKey,
                        <>
                          <label className="ap-box" htmlFor={`f-${idFor(descKey)}`}>
                            <span className="ap-label">Description</span>
                            <textarea
                              className="ap-input"
                              id={`f-${idFor(descKey)}`}
                              rows={2}
                              placeholder="One or two sentences about it"
                              value={svc.description}
                              aria-describedby={`e-${idFor(descKey)} c-${idFor(descKey)}`}
                              aria-invalid={Boolean(errFor(descKey))}
                              onChange={(e) => updateField(descKey, e.target.value)}
                            />
                          </label>
                          <div className="ap-meta">
                            <FieldError
                              message={errFor(descKey)}
                              id={`e-${idFor(descKey)}`}
                            />
                            <CharCount
                              fieldKey={descKey}
                              length={svc.description.length}
                              id={`c-${idFor(descKey)}`}
                            />
                          </div>
                        </>,
                        Boolean(errFor(descKey)),
                      )}
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                className="ap-textbtn ap-add"
                hidden={card.services.length >= CARD_FIELD_LIMITS.services}
                onClick={() =>
                  onCardChange({
                    ...card,
                    services: [...card.services, { title: "", description: "" }],
                  })
                }
              >
                <span className="ap-icon" aria-hidden>
                  <PlusIcon size={16} />
                </span>
                Add service
              </button>
              <p
                className="ap-limit"
                hidden={card.services.length < CARD_FIELD_LIMITS.services}
              >
                That&apos;s the maximum of {CARD_FIELD_LIMITS.services} services.
              </p>
            </div>
          </section>

          <section
            className="ap-sec"
            aria-labelledby="sec-links"
            data-sec
            data-collapsed={secCollapsed("links") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-links">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("links")}
                  aria-controls="body-links"
                  onClick={() => toggleSec("links")}
                >
                  <span className="ap-sec-name">Links</span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
              <p className="ap-sec-sub">
                All optional. Each one shows as an icon on your card.
              </p>
            </div>
            <div className="ap-sec-body" id="body-links">
              {(
                [
                  ["links.website", "Website", "f-website", WebsiteIcon, "https://"],
                  [
                    "links.linkedin",
                    "LinkedIn",
                    "f-linkedin",
                    LinkedinIcon,
                    "https://www.linkedin.com/in/",
                  ],
                  [
                    "links.github",
                    "GitHub",
                    "f-github",
                    GithubIcon,
                    "https://github.com/",
                  ],
                  [
                    "links.instagram",
                    "Instagram",
                    "f-instagram",
                    InstagramIcon,
                    "https://instagram.com/",
                  ],
                ] as const
              ).map(([key, label, fid, Icon, placeholder]) =>
                renderField(
                  key,
                  <>
                    <label className="ap-box" htmlFor={fid}>
                      <span className="ap-label">{label}</span>
                      <span className="ap-prefixed">
                        <span className="ap-icon ap-prefix-icon" aria-hidden>
                          <Icon size={18} />
                        </span>
                        <input
                          className="ap-input"
                          id={fid}
                          type="url"
                          inputMode="url"
                          placeholder={placeholder}
                          value={getPath(card, key)}
                          aria-describedby={`${fid}-err`}
                          aria-invalid={Boolean(errFor(key))}
                          onChange={(e) => updateField(key, e.target.value)}
                        />
                      </span>
                    </label>
                    <div className="ap-meta">
                      <FieldError message={errFor(key)} id={`${fid}-err`} />
                    </div>
                  </>,
                  Boolean(errFor(key)),
                ),
              )}
            </div>
          </section>

          <section
            className="ap-sec"
            aria-labelledby="sec-alt"
            data-sec
            data-collapsed={secCollapsed("alt") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-alt">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("alt")}
                  aria-controls="body-alt"
                  onClick={() => toggleSec("alt")}
                >
                  <span className="ap-sec-name">
                    Extra link{" "}
                    <span
                      className="ap-label-opt"
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--ink-muted)",
                      }}
                    >
                      (optional)
                    </span>
                  </span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
              <p className="ap-sec-sub" id="f-alt-help">
                Shows as a small link under the Exchange button on your card, like a
                booking page. It&apos;s never included in emails.
              </p>
            </div>
            <div className="ap-sec-body" id="body-alt">
              {renderField(
                "alternate.url",
                <>
                  <label className="ap-box" htmlFor="f-alt-url">
                    <span className="ap-label">Link</span>
                    <span className="ap-prefixed">
                      <span className="ap-icon ap-prefix-icon" aria-hidden>
                        <LinkIcon size={18} />
                      </span>
                      <input
                        className="ap-input"
                        id="f-alt-url"
                        type="url"
                        inputMode="url"
                        placeholder="https://"
                        value={card.alternate.url}
                        aria-describedby="f-alt-help f-alt-url-err"
                        aria-invalid={Boolean(errFor("alternate.url"))}
                        onChange={(e) => updateField("alternate.url", e.target.value)}
                      />
                    </span>
                  </label>
                  <div className="ap-meta">
                    <FieldError message={errFor("alternate.url")} id="f-alt-url-err" />
                  </div>
                </>,
                Boolean(errFor("alternate.url")),
              )}
              {renderField(
                "alternate.label",
                <>
                  <label className="ap-box" htmlFor="f-alt-label">
                    <span className="ap-label">Link text</span>
                    <input
                      className="ap-input"
                      id="f-alt-label"
                      placeholder="Book a time"
                      value={card.alternate.label}
                      aria-describedby="f-alt-label-help f-alt-label-err f-alt-label-count"
                      aria-invalid={Boolean(errFor("alternate.label"))}
                      onChange={(e) => updateField("alternate.label", e.target.value)}
                    />
                  </label>
                  <div className="ap-meta">
                    <p
                      className="ap-help"
                      id="f-alt-label-help"
                      hidden={Boolean(errFor("alternate.label"))}
                    >
                      If you leave this empty, this extra link won&apos;t show.
                    </p>
                    <FieldError
                      message={errFor("alternate.label")}
                      id="f-alt-label-err"
                    />
                    <CharCount
                      fieldKey="alternate.label"
                      length={card.alternate.label.length}
                      id="f-alt-label-count"
                    />
                  </div>
                </>,
                Boolean(errFor("alternate.label")),
              )}
            </div>
          </section>

          <section
            className="ap-sec"
            aria-labelledby="sec-leads"
            data-sec
            data-collapsed={secCollapsed("leads") ? "true" : "false"}
          >
            <div className="ap-sec-head">
              <h2 className="ap-sec-title" id="sec-leads">
                <button
                  type="button"
                  className="ap-sec-toggle"
                  aria-expanded={!secCollapsed("leads")}
                  aria-controls="body-leads"
                  onClick={() => toggleSec("leads")}
                >
                  <span className="ap-sec-name">Leads</span>
                  <span className="ap-icon ap-chev" aria-hidden>
                    <ChevronDownIcon size={20} />
                  </span>
                </button>
              </h2>
            </div>
            <div className="ap-sec-body" id="body-leads">
              <p className="ap-leads">
                <span className="ap-icon" aria-hidden>
                  <MailIcon size={18} />
                </span>
                <span>
                  Leads go to <strong>{session.email}</strong>
                </span>
              </p>
              <p className="ap-help ap-leads-note">
                Visitors who exchange contacts receive this address.
              </p>
            </div>
          </section>
        </form>

        <aside
          className="ap-preview-col"
          id="ap-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          aria-label="Card preview"
        >
          <div className="ap-preview-head">
            <span className="ap-preview-title">Preview</span>
            <span className="ap-preview-note">Exchange is off in the preview.</span>
          </div>
          <div className="ap-frame" data-frame>
            <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
              <AppCardPreview theme={appTheme} draft={card} />
            </div>
          </div>
        </aside>
      </div>

      <AppEditorBottomBar
        barRef={barRef}
        blockedOpen={blockedOpen}
        blockedText={blockedText}
        saveUi={saveUi}
        retrySave={retrySave}
        published={published}
        openShare={openShare}
        publishState={publishState}
        publishing={publishing}
        onPublish={handlePublish}
      />

      <AppEditorDialogs
        dialog={dialog}
        closeDialog={closeDialog}
        cropOpenSrc={cropOpenSrc}
        crop={crop}
        cropStyle={cropStyle}
        cropStageRef={cropStageRef}
        cropImgRef={cropImgRef}
        paintCrop={paintCrop}
        panRef={panRef}
        onCropImageLoad={onCropImageLoad}
        useCroppedPhoto={useCroppedPhoto}
        pubTitle={pubTitle}
        pubUrl={pubUrl}
        copyLabel={copyLabel}
        copyPubUrl={copyPubUrl}
        signingIn={signingIn}
        onSignIn={onSignIn}
        api={api}
        onSessionRestored={onSessionRestored}
        scheduleSave={scheduleSave}
        publishSlug={card.slug}
        onConfirmPublish={() => {
          closeDialog();
          void runPublishFlow();
        }}
        isPreviewEnv={isPreviewEnv}
        previewSecret={previewSecret}
        onPreviewLogin={onPreviewLogin ?? onSignIn}
      />

      <p className="ap-sr" role="status" aria-live="polite" id={announceId}>
        {announce}
      </p>
    </div>
  );
}
