// @vitest-environment jsdom

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { hiChipFixtures } from "../helpers/hi-chips";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHIPS_OPENED_STORAGE_KEY } from "@/components/hi/hi-chip-popover-position";
import { HiWhatIDoChips } from "@/components/hi/HiWhatIDoChips";

const chips = hiChipFixtures;

function renderChips() {
  return render(
    <ThemeProvider>
      <HiWhatIDoChips chips={chips} />
    </ThemeProvider>,
  );
}

function chipButton(label: string, root: HTMLElement) {
  return within(root).getByRole("button", { name: label });
}

function queryPopover() {
  return document.getElementById("chip-pop");
}

function stubMatchMedia(reducedMotion = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reducedMotion && query.includes("reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

function stubAnimate() {
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

describe("HiWhatIDoChips", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
    stubMatchMedia(false);
    stubAnimate();
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
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens a popover with the chip explanation", async () => {
    const { container } = renderChips();
    fireEvent.click(chipButton("System audit", container));
    await waitFor(() => {
      expect(queryPopover()?.textContent).toContain(chips[0].explanation);
    });
    expect(chipButton("System audit", container).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("closes when the same chip is tapped again", async () => {
    const { container } = renderChips();
    const btn = chipButton("System audit", container);
    fireEvent.click(btn);
    await waitFor(() => expect(queryPopover()).toBeTruthy());
    fireEvent.click(btn);
    await waitFor(() => expect(queryPopover()).toBeNull());
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on outside pointerdown", async () => {
    const { container } = renderChips();
    fireEvent.click(chipButton("Custom development", container));
    await waitFor(() => expect(queryPopover()).toBeTruthy());
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(queryPopover()).toBeNull());
  });

  it("closes on Escape and returns focus to the chip", async () => {
    const { container } = renderChips();
    const btn = chipButton("Technical advisory", container);
    fireEvent.click(btn);
    await waitFor(() => expect(queryPopover()).toBeTruthy());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(queryPopover()).toBeNull());
    expect(document.activeElement).toBe(btn);
  });

  it("keeps only one popover open at a time", async () => {
    const { container } = renderChips();
    fireEvent.click(chipButton("System audit", container));
    await waitFor(() =>
      expect(queryPopover()?.textContent).toContain(chips[0].explanation),
    );
    fireEvent.click(chipButton("Fractional CTO", container));
    await waitFor(() =>
      expect(queryPopover()?.textContent).toContain(chips[3].explanation),
    );
    expect(chipButton("System audit", container).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(chipButton("Fractional CTO", container).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("shows each chip's own explanation", async () => {
    const { container } = renderChips();
    for (const chip of chips) {
      fireEvent.click(chipButton(chip.label, container));
      await waitFor(() =>
        expect(queryPopover()?.textContent).toContain(chip.explanation),
      );
      fireEvent.pointerDown(document.body);
      await waitFor(() => expect(queryPopover()).toBeNull());
    }
  });

  describe("hint animation", () => {
    let ioCallback: IntersectionObserverCallback | null = null;

    beforeEach(() => {
      class MockIO {
        constructor(cb: IntersectionObserverCallback) {
          ioCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      }
      vi.stubGlobal("IntersectionObserver", MockIO);
    });

    it("plays the hint once when the row becomes visible", async () => {
      renderChips();
      expect(ioCallback).not.toBeNull();
      ioCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await waitFor(() => {
        expect(HTMLElement.prototype.animate).toHaveBeenCalled();
      });
      const hintCalls = vi
        .mocked(HTMLElement.prototype.animate)
        .mock.calls.filter((args) => {
          const opts = args[1] as KeyframeAnimationOptions | undefined;
          return opts && typeof opts.delay === "number" && opts.delay >= 200;
        });
      expect(hintCalls.length).toBe(chips.length);
    });

    it("cancels the hint when a chip opens", async () => {
      const cancel = vi.fn();
      HTMLElement.prototype.animate = vi.fn(function () {
        return {
          cancel,
          onfinish: null,
          finished: Promise.resolve(),
        } as unknown as Animation;
      });
      const { container } = renderChips();
      ioCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      fireEvent.click(chipButton("System audit", container));
      await waitFor(() => expect(cancel).toHaveBeenCalled());
    });

    it("does not play when didi-chips-opened is stored", () => {
      localStorage.setItem(CHIPS_OPENED_STORAGE_KEY, "1");
      renderChips();
      ioCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      const hintCalls = vi
        .mocked(HTMLElement.prototype.animate)
        .mock.calls.filter((args) => {
          const opts = args[1] as KeyframeAnimationOptions | undefined;
          return opts && typeof opts.delay === "number" && opts.delay >= 200;
        });
      expect(hintCalls).toHaveLength(0);
    });

    it("skips the hint with prefers-reduced-motion", () => {
      vi.unstubAllGlobals();
      stubMatchMedia(true);
      stubAnimate();
      renderChips();
      ioCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      const hintCalls = vi
        .mocked(HTMLElement.prototype.animate)
        .mock.calls.filter((args) => {
          const opts = args[1] as KeyframeAnimationOptions | undefined;
          return opts && typeof opts.delay === "number" && opts.delay >= 200;
        });
      expect(hintCalls).toHaveLength(0);
    });

    it("still works when localStorage throws", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      const { container } = renderChips();
      fireEvent.click(chipButton("AI Integrations", container));
      await waitFor(() => {
        expect(queryPopover()?.textContent).toContain(chips[4].explanation);
      });
    });
  });
});
