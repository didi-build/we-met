"use client";

import { AppCardEditor } from "@/components/app/AppCardEditor";
import { useAppThemeToggle } from "@/components/app/AppThemeProvider";
import {
  GoogleGIcon,
  MoonIcon,
  PersonIcon,
  SunIcon,
} from "@/components/app/icons/AppIcons";
import { useAppApi } from "@/app-api/AppApiProvider";
import { AppApiError, type AppSession, type EditorCard } from "@/app-api/types";
import { WeMetMarkIcon } from "@/components/hi/icons/HiCardIcons";
import { WE_MET_CARD_HOME_URL } from "@/lib/hi-card/card-content";
import { useCallback, useEffect, useRef, useState } from "react";

type AppView = "login" | "closed" | "editor";

export function WeMetApp() {
  const api = useAppApi();
  const { toggle, dark } = useAppThemeToggle();
  const [view, setView] = useState<AppView>("login");
  const [session, setSession] = useState<AppSession | null>(null);
  const [draft, setDraft] = useState<EditorCard | null>(null);
  const [published, setPublished] = useState<EditorCard | null>(null);
  const [booting, setBooting] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [previewSecret, setPreviewSecret] = useState("");
  const isPreviewEnv = process.env.NEXT_PUBLIC_WE_MET_ENV === "preview";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const loadCard = useCallback(async () => {
    const bundle = await api.getCard();
    setDraft(bundle.draft);
    setPublished(bundle.published);
    setView("editor");
  }, [api]);

  const routeSession = useCallback(
    async (s: AppSession | null) => {
      setSession(s);
      if (!s) {
        setView("login");
        setDraft(null);
        setPublished(null);
        return;
      }
      if (!s.allowed) {
        setView("closed");
        setDraft(null);
        setPublished(null);
        return;
      }
      await loadCard();
    },
    [loadCard],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      setLoginError(true);
      params.delete("auth_error");
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await api.getSession();
      if (cancelled) {
        return;
      }
      await routeSession(s);
      if (!cancelled) {
        setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, routeSession]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!menuOpen) {
        return;
      }
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) {
        return;
      }
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSignIn = useCallback(
    async (mode: "redirect" | "popup" = "redirect") => {
      setLoginError(false);
      setSigningIn(true);
      try {
        const s = await api.signIn(mode);
        setSigningIn(false);
        await routeSession(s);
      } catch (err) {
        setSigningIn(false);
        if (err instanceof AppApiError && err.code === "canceled") {
          setLoginError(true);
        } else if (!(err instanceof AppApiError)) {
          setLoginError(true);
        }
      }
    },
    [api, routeSession],
  );

  const handlePreviewLogin = useCallback(async () => {
    setLoginError(false);
    setSigningIn(true);
    try {
      const response = await fetch("/api/auth/preview-login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ secret: previewSecret }),
      });
      setSigningIn(false);
      if (!response.ok) {
        setLoginError(true);
        return;
      }
      const body = (await response.json()) as { session: AppSession };
      await routeSession(body.session);
    } catch {
      setSigningIn(false);
      setLoginError(true);
    }
  }, [previewSecret, routeSession]);

  const handleSignOut = useCallback(async () => {
    setMenuOpen(false);
    await api.signOut();
    await routeSession(null);
  }, [api, routeSession]);

  const handleSessionRestored = useCallback(
    async (s: AppSession) => {
      setSession(s);
      if (s.allowed) {
        await loadCard();
      }
    },
    [loadCard],
  );

  if (booting) {
    return null;
  }

  return (
    <>
      <header className="ap-header">
        <a className="ap-brand" href={WE_MET_CARD_HOME_URL}>
          <span className="ap-icon" aria-hidden>
            <WeMetMarkIcon size={28} />
          </span>
          We Met
        </a>
        <div className="ap-header-right">
          <button
            type="button"
            className="ap-iconbtn"
            onClick={toggle}
            aria-label={dark ? "Use light mode" : "Use dark mode"}
          >
            <span className="ap-icon ap-sun" aria-hidden>
              <SunIcon size={20} />
            </span>
            <span className="ap-icon ap-moon" aria-hidden>
              <MoonIcon size={20} />
            </span>
          </button>
          {session ? (
            <div className="ap-account">
              <button
                ref={menuBtnRef}
                type="button"
                className="ap-avatar-btn"
                aria-label="Account"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="ap-menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span>
                  <span className="ap-icon" aria-hidden>
                    <PersonIcon size={26} />
                  </span>
                </span>
              </button>
              <div
                ref={menuRef}
                className="ap-menu"
                id="ap-menu"
                role="menu"
                aria-label="Account"
                hidden={!menuOpen}
              >
                <p className="ap-menu-label">Signed in as</p>
                <p className="ap-menu-email">{session.email}</p>
                <div className="ap-menu-rule" aria-hidden />
                <button
                  type="button"
                  className="ap-menu-item"
                  role="menuitem"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {view === "login" ? (
        <main className="ap-login">
          <span className="ap-icon ap-login-mark" aria-hidden>
            <WeMetMarkIcon size={56} />
          </span>
          <h1 className="ap-login-title">Make your We Met card</h1>
          <p className="ap-login-sub">
            One link to share when you meet people. Free, and it takes a few minutes.
          </p>
          <div className="ap-login-actions">
            <div className="ap-alert" role="alert" hidden={!loginError}>
              <span className="ap-alert-mark" aria-hidden>
                !
              </span>
              <span>
                Sign-in didn&apos;t finish. Try again, or choose a different Google
                account.
              </span>
            </div>
            {isPreviewEnv ? (
              <>
                <label className="ap-field">
                  <span className="ap-field-label">Preview sign-in</span>
                  <input
                    type="password"
                    className="ap-input"
                    autoComplete="off"
                    value={previewSecret}
                    onChange={(event) => setPreviewSecret(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="ap-btn ap-btn-block"
                  aria-busy={signingIn}
                  disabled={signingIn || previewSecret.length === 0}
                  onClick={handlePreviewLogin}
                >
                  {signingIn ? "Signing in…" : "Sign in with preview secret"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ap-google"
                aria-busy={signingIn}
                disabled={signingIn}
                onClick={() => handleSignIn("redirect")}
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
            <p className="ap-login-note">
              Leads from your card are emailed to your Google address.
            </p>
          </div>
        </main>
      ) : null}

      {view === "closed" && session ? (
        <main className="ap-login">
          <span className="ap-icon ap-login-mark" aria-hidden>
            <WeMetMarkIcon size={56} />
          </span>
          <h1 className="ap-login-title">Sign-up isn&apos;t open yet</h1>
          <p className="ap-login-sub">
            We Met is open to a small group for now. You&apos;re signed in as{" "}
            <strong>{session.email}</strong>.
          </p>
          <div className="ap-login-actions">
            <button
              type="button"
              className="ap-btn ap-btn-outline ap-btn-block"
              onClick={handleSignOut}
            >
              Use a different account
            </button>
          </div>
        </main>
      ) : null}

      {view === "editor" && session && draft ? (
        <AppCardEditor
          session={session}
          initialDraft={draft}
          initialPublished={published}
          onSessionRestored={handleSessionRestored}
          onSignIn={() => handleSignIn("popup")}
          signingIn={signingIn}
        />
      ) : null}
    </>
  );
}
