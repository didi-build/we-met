import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSheetCloseAnimation } from "@/components/hi/hi-sheet-motion";

type MockPanel = HTMLElement & {
  transformLog: string[];
  dispatchTransitionEnd: () => void;
};

function createMockPanel(height = 400): MockPanel {
  const transformLog: string[] = [];
  let transformValue = "";
  const transitionEndHandlers = new Set<(event: TransitionEvent) => void>();
  const panel = {
    offsetHeight: height,
    style: {
      _animation: "",
      _transition: "",
      get animation() {
        return this._animation;
      },
      set animation(value: string) {
        this._animation = value;
      },
      get transition() {
        return this._transition;
      },
      set transition(value: string) {
        this._transition = value;
      },
      get transform() {
        return transformValue;
      },
      set transform(value: string) {
        transformLog.push(value);
        transformValue = value;
      },
    },
    getBoundingClientRect: () => ({}),
    addEventListener(type: string, handler: EventListener) {
      if (type === "transitionend") {
        transitionEndHandlers.add(handler as (event: TransitionEvent) => void);
      }
    },
    removeEventListener(_type: string, handler: EventListener) {
      transitionEndHandlers.delete(handler as (event: TransitionEvent) => void);
    },
    dispatchTransitionEnd() {
      const event = {
        target: panel,
        propertyName: "transform",
      } as unknown as TransitionEvent;
      transitionEndHandlers.forEach((handler) => handler(event));
    },
    transformLog,
  };
  return panel as unknown as MockPanel;
}

describe("runSheetCloseAnimation", () => {
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
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("completes on transitionend without resetting transform to the open position", () => {
    const panel = createMockPanel();
    const onComplete = vi.fn();

    runSheetCloseAnimation({ panel, scrim: null, dy: 80, velocity: 2, onComplete });

    expect(panel.style.transform).toBe("translateY(100%)");
    expect(panel.transformLog).not.toContain("");
    expect(panel.transformLog).not.toContain("translateY(0)");

    panel.dispatchTransitionEnd();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(panel.style.transform).toBe("translateY(100%)");
    expect(panel.transformLog).not.toContain("");
    expect(panel.transformLog).not.toContain("translateY(0)");
  });

  it("falls back to a timeout when transitionend does not fire", () => {
    vi.useFakeTimers();
    const panel = createMockPanel();
    const onComplete = vi.fn();

    runSheetCloseAnimation({ panel, scrim: null, onComplete });

    expect(onComplete).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(panel.transformLog).not.toContain("translateY(0)");
    vi.useRealTimers();
  });
});
