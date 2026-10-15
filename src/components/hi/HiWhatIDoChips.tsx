"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import {
  CHIPS_OPENED_STORAGE_KEY,
  measureChipPopoverPosition,
  type ChipPopoverPosition,
} from "@/components/hi/hi-chip-popover-position";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type HiChipItem = {
  label: string;
  explanation: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ChipPlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  );
}

function pillBackground(open: boolean, pressed: boolean, hover: boolean): string {
  if (open) {
    return pressed ? "var(--accent-hover)" : "var(--accent)";
  }
  if (pressed) {
    return "color-mix(in oklch, var(--accent-soft), var(--ink) 12%)";
  }
  if (hover) {
    return "color-mix(in oklch, var(--accent-soft), var(--ink) 6%)";
  }
  return "var(--accent-soft)";
}

type HiWhatIDoChipsProps = {
  chips: readonly HiChipItem[];
  interactive?: boolean;
};

export function HiWhatIDoChips({ chips, interactive = true }: HiWhatIDoChipsProps) {
  const { theme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hintAnimsRef = useRef<Animation[]>([]);
  const closeAnimRef = useRef<Animation | null>(null);
  const posKeyRef = useRef<string | null>(null);
  const hintPlayedRef = useRef(false);
  const closingRef = useRef(false);
  const fadedRef = useRef(false);

  const [openIndex, setOpenIndex] = useState(-1);
  const [popoverPos, setPopoverPos] = useState<ChipPopoverPosition | null>(null);
  const [pressedIndex, setPressedIndex] = useState(-1);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [hintSpent, setHintSpent] = useState(false);
  const [renderOpen, setRenderOpen] = useState(false);

  const stopHint = useCallback(() => {
    iconRefs.current.forEach((el) => {
      if (!el) return;
      el.classList.remove("animate-hi-hint");
      el.style.animationDelay = "";
    });
    hintAnimsRef.current.forEach((a) => a.cancel());
    hintAnimsRef.current = [];
  }, []);

  const measure = useCallback(() => {
    if (openIndex < 0) return;
    const chip = pillRefs.current[openIndex];
    const pop = popoverRef.current;
    const root = rootRef.current;
    if (!chip || !pop || !root) return;

    const w = Math.min(280, document.documentElement.clientWidth - 32);
    pop.style.width = `${w}px`;
    const popoverHeight = pop.offsetHeight;
    const pos = measureChipPopoverPosition({
      chipRect: chip.getBoundingClientRect(),
      rootRect: root.getBoundingClientRect(),
      popoverHeight,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: window.innerHeight,
    });
    const key = JSON.stringify(pos);
    if (key !== posKeyRef.current || !popoverPos) {
      posKeyRef.current = key;
      setPopoverPos(pos);
    }
  }, [openIndex, popoverPos]);

  const finishClose = useCallback(
    (focusChip: boolean) => {
      const prev = openIndex;
      closingRef.current = false;
      closeAnimRef.current = null;
      posKeyRef.current = null;
      fadedRef.current = false;
      setOpenIndex(-1);
      setPopoverPos(null);
      setRenderOpen(false);
      if (focusChip && prev >= 0) {
        btnRefs.current[prev]?.focus();
      }
    },
    [openIndex],
  );

  const closePopover = useCallback(
    (focusChip: boolean) => {
      if (openIndex < 0 || closingRef.current) return;
      closingRef.current = true;
      const pop = popoverRef.current;
      if (pop && !prefersReducedMotion()) {
        closeAnimRef.current = pop.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 120,
          easing: "cubic-bezier(.4,0,1,1)",
          fill: "forwards",
        });
        closeAnimRef.current.onfinish = () => finishClose(focusChip);
      } else {
        finishClose(focusChip);
      }
    },
    [finishClose, openIndex],
  );

  const openChip = useCallback(
    (index: number) => {
      stopHint();
      if (closeAnimRef.current) {
        closeAnimRef.current.cancel();
        closeAnimRef.current = null;
      }
      closingRef.current = false;
      fadedRef.current = false;
      posKeyRef.current = null;
      setHintSpent(true);
      setRenderOpen(true);
      setOpenIndex(index);
      setPopoverPos(null);
      try {
        localStorage.setItem(CHIPS_OPENED_STORAGE_KEY, "1");
      } catch {
        // storage blocked
      }
    },
    [stopHint],
  );

  const toggleChip = useCallback(
    (index: number) => {
      if (openIndex === index) {
        closePopover(false);
        return;
      }
      openChip(index);
    },
    [closePopover, openChip, openIndex],
  );

  const playHint = useCallback(() => {
    if (prefersReducedMotion() || hintSpent || hintPlayedRef.current) return;
    hintPlayedRef.current = true;
    iconRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.animationDelay = `${200 + i * 70}ms`;
      el.classList.add("animate-hi-hint");
      const onEnd = () => {
        el.classList.remove("animate-hi-hint");
        el.style.animationDelay = "";
        el.removeEventListener("animationend", onEnd);
      };
      el.addEventListener("animationend", onEnd);
    });
  }, [hintSpent]);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHIPS_OPENED_STORAGE_KEY) === "1") {
        setHintSpent(true);
      }
    } catch {
      // storage blocked
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          playHint();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [playHint]);

  useLayoutEffect(() => {
    if (openIndex >= 0 && !popoverPos) {
      measure();
    } else if (popoverPos && popoverRef.current && !fadedRef.current) {
      fadedRef.current = true;
      if (!prefersReducedMotion()) {
        const slide = popoverPos.above ? 4 : -4;
        popoverRef.current.animate(
          [
            { opacity: 0, transform: `translateY(${slide}px)` },
            { opacity: 1, transform: "none" },
          ],
          { duration: 120, easing: "cubic-bezier(0,0,.2,1)" },
        );
      }
    }
  }, [measure, openIndex, popoverPos]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (openIndex < 0) return;
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-hi-chip-btn]")) return;
      closePopover(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openIndex >= 0) {
        const sheetOpen = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (sheetOpen) return;
        closePopover(true);
      }
    };

    const onScroll = (e: Event) => {
      if (openIndex < 0) return;
      const target = e.target;
      if (popoverRef.current?.contains(target as Node)) return;
      closePopover(false);
    };

    const onResize = () => {
      if (openIndex >= 0 && !closingRef.current) {
        posKeyRef.current = null;
        measure();
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (openIndex < 0) return;
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      closePopover(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocusIn, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [closePopover, measure, openIndex]);

  useEffect(() => () => stopHint(), [stopHint]);

  const activeChip = openIndex >= 0 ? chips[openIndex] : null;
  const popoverBg = theme === "dark" ? "var(--surface-2)" : "var(--surface)";
  const popoverShadow = "var(--chip-popover-shadow)";
  const borderLine = "1px solid var(--line)";
  const above = popoverPos?.above ?? false;

  if (!interactive) {
    return (
      <div className="relative">
        <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-0 p-0">
          {chips.map((chip) => (
            <li key={chip.label} className="flex">
              <span
                className="relative inline-flex min-h-8 items-center gap-1.5 rounded-pill px-2.5 py-0 pl-3 text-sm font-medium leading-normal whitespace-nowrap"
                style={{ background: "var(--accent-soft)", color: "var(--ink)" }}
              >
                <span>{chip.label}</span>
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center text-ink-muted"
                  aria-hidden
                >
                  <ChipPlusIcon />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-0 p-0">
        {chips.map((chip, index) => {
          const open = openIndex === index;
          const pressed = pressedIndex === index;
          const hover = hoverIndex === index;
          const fg = open ? "var(--accent-ink)" : "var(--ink)";
          const iconColor = open ? "var(--accent-ink)" : "var(--ink-muted)";
          const iconTransform = open ? "rotate(45deg)" : "none";

          return (
            <li key={chip.label} className="flex">
              <button
                type="button"
                data-hi-chip-btn
                ref={(el) => {
                  btnRefs.current[index] = el;
                }}
                aria-expanded={open}
                aria-controls="chip-pop"
                onClick={() => toggleChip(index)}
                onPointerDown={() => setPressedIndex(index)}
                onPointerUp={() => setPressedIndex(-1)}
                onPointerCancel={() => setPressedIndex(-1)}
                onPointerEnter={(e: ReactPointerEvent) => {
                  if (e.pointerType === "mouse") setHoverIndex(index);
                }}
                onPointerLeave={() => {
                  setHoverIndex(-1);
                  setPressedIndex(-1);
                }}
                className="m-0 flex cursor-pointer items-center rounded-pill border-0 bg-transparent p-0 py-1.5 font-[inherit] text-inherit [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent"
              >
                <span
                  ref={(el) => {
                    pillRefs.current[index] = el;
                  }}
                  className="relative inline-flex min-h-8 items-center gap-1.5 rounded-pill px-2.5 py-0 pl-3 text-sm font-medium leading-normal whitespace-nowrap transition-[background-color,color] duration-[120ms] ease-[cubic-bezier(.4,0,.2,1)]"
                  style={{
                    background: pillBackground(open, pressed, hover),
                    color: fg,
                  }}
                >
                  <span>{chip.label}</span>
                  <span
                    ref={(el) => {
                      iconRefs.current[index] = el;
                    }}
                    className="flex h-3.5 w-3.5 items-center justify-center transition-[transform,color] duration-[120ms] ease-[cubic-bezier(.4,0,.2,1)]"
                    style={{ color: iconColor, transform: iconTransform }}
                  >
                    <ChipPlusIcon />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {renderOpen && activeChip && (
        <div
          ref={popoverRef}
          id="chip-pop"
          role="note"
          className="absolute z-[5] box-border rounded-[14px] border border-line px-4 pt-3.5 pb-[15px] text-left"
          style={{
            left: popoverPos ? `${popoverPos.left}px` : 0,
            top: popoverPos ? `${popoverPos.top}px` : 0,
            width: popoverPos ? `${popoverPos.w}px` : "280px",
            visibility: popoverPos ? "visible" : "hidden",
            background: popoverBg,
            color: "var(--ink)",
            boxShadow: popoverShadow,
          }}
        >
          <span
            aria-hidden
            className="absolute box-border h-3 w-3 rotate-45"
            style={{
              left: popoverPos ? `${popoverPos.arrowX - 6}px` : "34px",
              top: above ? "auto" : "-6px",
              bottom: above ? "-6px" : "auto",
              background: popoverBg,
              borderTop: above ? "0" : borderLine,
              borderLeft: above ? "0" : borderLine,
              borderRight: above ? borderLine : "0",
              borderBottom: above ? borderLine : "0",
            }}
          />
          <p className="relative m-0 mb-1 text-[15px] leading-[1.35] font-semibold text-accent-text">
            {activeChip.label}
          </p>
          <p className="relative m-0 text-[15px] leading-normal text-ink text-pretty">
            {activeChip.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
