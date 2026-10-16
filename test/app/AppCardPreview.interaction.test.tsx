// @vitest-environment jsdom

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

import { emptyEditorCard } from "@/app-api/stub-api";
import {
  AppCardPreview,
  blockPreviewLinkNavigation,
} from "@/components/app/editor/AppCardPreview";
import { AppThemeProvider } from "@/components/app/AppThemeProvider";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

function injectPaletteCss() {
  if (document.getElementById("test-palette-tokens")) {
    return;
  }
  const dir = join(process.cwd(), "src/theme/tokens");
  const style = document.createElement("style");
  style.id = "test-palette-tokens";
  style.textContent = ["mono.light.css", "mono.dark.css"]
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  document.head.appendChild(style);
}

function richDraft() {
  return {
    ...emptyEditorCard(),
    name: "Ada Lovelace",
    slug: "ada",
    role: "Engineer",
    about: ["First paragraph.", "Second paragraph for show more."],
    services: [{ title: "Consulting", description: "One-on-one advice." }],
    links: {
      website: "https://example.com",
      linkedin: "https://linkedin.com/in/ada",
      github: "",
      instagram: "",
    },
    alternate: { url: "https://book.example.com", label: "Book a time" },
  };
}

function renderPreview(draft = richDraft()) {
  return render(
    <AppThemeProvider>
      <div className="ap">
        <AppCardPreview theme="light" draft={draft} />
      </div>
    </AppThemeProvider>,
  );
}

function stubChipLayout() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    if (this.id === "chip-pop") {
      return {
        left: 40,
        top: 350,
        width: 280,
        height: 100,
        right: 320,
        bottom: 450,
      } as DOMRect;
    }
    return {
      left: 40,
      top: 300,
      width: 120,
      height: 32,
      right: 160,
      bottom: 332,
    } as DOMRect;
  });
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  HTMLElement.prototype.animate = vi.fn(function () {
    const anim = {
      cancel: vi.fn(),
      onfinish: null as (() => void) | null,
      finished: Promise.resolve(),
    };
    queueMicrotask(() => {
      anim.onfinish?.();
    });
    return anim as unknown as Animation;
  });
}

function clickLinkExpectBlocked(link: HTMLAnchorElement) {
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(true);
}

beforeAll(() => {
  injectPaletteCss();
});

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.setAttribute("data-palette", "mono");
  localStorage.clear();
  stubChipLayout();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AppCardPreview interaction (integration)", () => {
  it("does not use inert on the preview shell", () => {
    renderPreview();
    const shell = screen.getByTestId("app-card-preview");
    expect(shell.hasAttribute("inert")).toBe(false);
  });

  it("opens chip popover on chip click", async () => {
    renderPreview();
    const shell = screen.getByTestId("app-card-preview");
    fireEvent.click(within(shell).getByRole("button", { name: "Consulting" }));
    await waitFor(() => {
      expect(document.getElementById("chip-pop")?.textContent).toContain(
        "One-on-one advice.",
      );
    });
  });

  it("toggles About show more and show less", () => {
    renderPreview();
    const shell = screen.getByTestId("app-card-preview");
    expect(within(shell).queryByText("Second paragraph for show more.")).toBeNull();
    fireEvent.click(within(shell).getByRole("button", { name: /Show more/i }));
    expect(within(shell).getByText("Second paragraph for show more.")).toBeTruthy();
    fireEvent.click(within(shell).getByRole("button", { name: /Show less/i }));
    expect(within(shell).queryByText("Second paragraph for show more.")).toBeNull();
  });

  it("blocks navigation on strip, band, social, alternate, and attribution links", () => {
    renderPreview();
    const shell = screen.getByTestId("app-card-preview");
    const anchors = shell.querySelectorAll("a[href]");
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect((anchor as HTMLAnchorElement).tabIndex).toBe(-1);
      clickLinkExpectBlocked(anchor as HTMLAnchorElement);
    }
  });

  it("Exchange click does not fetch or open exchange sheet", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderPreview();
    const shell = screen.getByTestId("app-card-preview");
    fireEvent.click(within(shell).getByRole("button", { name: /Exchange contact/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    fetchSpy.mockRestore();
  });
});

describe("blockPreviewLinkNavigation (unit)", () => {
  it("prevents default on anchor click in root", () => {
    const root = document.createElement("div");
    const a = document.createElement("a");
    a.href = "https://example.com";
    root.appendChild(a);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: a });
    blockPreviewLinkNavigation(ev, root);
    expect(ev.defaultPrevented).toBe(true);
  });
});
