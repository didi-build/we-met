export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function sheetCloseDurationMs(height: number, dy = 0, velocity = 1.4): number {
  return Math.round(
    Math.max(150, Math.min(280, (height - dy) / Math.max(velocity, 1.4))),
  );
}

/** Clears inline motion styles so a reopened sheet can use CSS enter animations. */
export function clearSheetMotionInlineStyles(
  panel: HTMLElement,
  scrim: HTMLElement | null,
): void {
  panel.style.removeProperty("animation");
  panel.style.removeProperty("transition");
  panel.style.removeProperty("transform");
  if (scrim) {
    scrim.style.removeProperty("animation");
    scrim.style.removeProperty("transition");
    scrim.style.removeProperty("opacity");
  }
}

export type SheetCloseAnimationOptions = {
  panel: HTMLElement;
  scrim: HTMLElement | null;
  dy?: number;
  velocity?: number;
  onComplete: () => void;
};

/**
 * Animates the sheet closed. Calls onComplete when done without resetting inline styles
 * (the parent should unmount the sheet in onComplete).
 */
export function runSheetCloseAnimation(
  options: SheetCloseAnimationOptions,
): () => void {
  const { panel, scrim, dy = 0, velocity = 1.4, onComplete } = options;

  if (prefersReducedMotion()) {
    onComplete();
    return () => {};
  }

  const h = panel.offsetHeight;
  const dur = sheetCloseDurationMs(h, dy, velocity);

  panel.style.animation = "none";
  if (scrim) {
    scrim.style.animation = "none";
  }

  if (dy > 0) {
    panel.style.transition = "none";
    panel.style.transform = `translateY(${dy}px)`;
  }
  void panel.getBoundingClientRect();

  panel.style.transition = `transform ${dur}ms cubic-bezier(0.2, 0.6, 0.35, 1)`;
  panel.style.transform = "translateY(100%)";
  if (scrim) {
    scrim.style.transition = `opacity ${dur}ms ease-out`;
    scrim.style.opacity = "0";
  }

  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    panel.removeEventListener("transitionend", onTransitionEnd);
    window.clearTimeout(fallbackTimer);
    onComplete();
  };

  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== panel || event.propertyName !== "transform") {
      return;
    }
    finish();
  };

  panel.addEventListener("transitionend", onTransitionEnd);
  const fallbackTimer = window.setTimeout(finish, dur + 50);

  return () => {
    finished = true;
    panel.removeEventListener("transitionend", onTransitionEnd);
    window.clearTimeout(fallbackTimer);
  };
}
