// @vitest-environment jsdom

import { AppCardPreview } from "@/components/app/editor/AppCardPreview";
import { emptyEditorCard } from "@/app-api/stub-api";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

vi.mock("@/components/hi/hi-sheet-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/components/hi/hi-sheet-motion")>();
  return {
    ...mod,
    prefersReducedMotion: () => true,
    runSheetCloseAnimation: ({ onComplete }: { onComplete: () => void }) => {
      onComplete();
      return () => {};
    },
  };
});

function injectCss(id: string, files: string[]) {
  const dir = join(process.cwd(), "src");
  const style = document.createElement("style");
  style.id = id;
  style.textContent = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  document.head.appendChild(style);
}

function resolvedToken(prop: "color" | "backgroundColor", token: string): string {
  const el = document.createElement("div");
  el.style[prop] = `var(${token})`;
  document.body.appendChild(el);
  const value = getComputedStyle(el)[prop];
  document.body.removeChild(el);
  return value;
}

function mountPreview(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-palette", "mono");
  return render(
    <div className="ap" data-theme={theme}>
      <AppCardPreview
        theme={theme}
        draft={{
          ...emptyEditorCard(),
          name: "Ada Lovelace",
          role: "Engineer",
          slug: "ada",
        }}
      />
    </div>,
  );
}

describe("AppCardPreview link contrast (integration)", () => {
  beforeAll(() => {
    injectCss("test-palette-tokens", [
      "theme/tokens/mono.light.css",
      "theme/tokens/mono.dark.css",
    ]);
    injectCss("test-globals", ["app/globals.css"]);
    injectCss("test-app-editor", ["app/app-editor.css"]);
    injectCss("test-tailwind-shims", []);
    const shim = document.getElementById("test-tailwind-shims")!;
    shim.textContent = `
      .bg-ink { background-color: var(--ink); }
      .bg-bg { background-color: var(--bg); }
      .text-ink { color: var(--ink); }
    `;
  });

  for (const theme of ["light", "dark"] as const) {
    it(`strip link text contrasts with bg-ink strip in ${theme} mode`, async () => {
      mountPreview(theme);
      await waitFor(() => {
        expect(document.querySelector("a.hi-link-strip.bg-ink")).toBeTruthy();
      });
      const strip = document.querySelector(
        "a.hi-link-strip.bg-ink",
      ) as HTMLAnchorElement;
      const text = strip.querySelector(".hi-link-strip-text") as HTMLElement;
      const fg = getComputedStyle(text).color;
      const stripBg = getComputedStyle(strip).backgroundColor;
      expect(fg).toBe(resolvedToken("color", "--bg"));
      expect(stripBg).toBe(resolvedToken("backgroundColor", "--ink"));
      expect(fg).not.toBe(stripBg);
    });

    it(`band link contrasts in ${theme} mode`, async () => {
      mountPreview(theme);
      await waitFor(() => {
        expect(
          document.querySelectorAll("a.hi-link-strip.bg-ink").length,
        ).toBeGreaterThan(1);
      });
      const strips = document.querySelectorAll("a.hi-link-strip.bg-ink");
      const band = strips[strips.length - 1] as HTMLAnchorElement;
      const fg = getComputedStyle(band).color;
      const stripBg = getComputedStyle(band).backgroundColor;
      expect(fg).toBe(resolvedToken("color", "--bg"));
      expect(stripBg).toBe(resolvedToken("backgroundColor", "--ink"));
    });
  }

  it("session dialog copy says changes are kept on this page", async () => {
    const { AppEditorDialogs } =
      await import("@/components/app/editor/AppEditorDialogs");
    const api = {
      getSession: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getCard: vi.fn(),
      saveDraft: vi.fn(),
      checkSlug: vi.fn(),
      uploadPhoto: vi.fn(),
      publish: vi.fn(),
    };
    render(
      <AppEditorDialogs
        dialog="session"
        closeDialog={() => {}}
        cropOpenSrc={null}
        crop={null}
        cropStageRef={{ current: null }}
        cropImgRef={{ current: null }}
        paintCrop={() => {}}
        panRef={{ current: null }}
        onCropImageLoad={() => {}}
        useCroppedPhoto={() => {}}
        pubTitle=""
        pubUrl=""
        copyLabel=""
        copyPubUrl={() => {}}
        signingIn={false}
        onSignIn={async () => {}}
        api={api}
        onSessionRestored={() => {}}
        scheduleSave={() => {}}
      />,
    );
    expect(document.body.textContent).toMatch(/kept on this page/i);
    expect(document.body.textContent).not.toMatch(/kept on this device/i);
  });
});
