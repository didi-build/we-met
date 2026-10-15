/** Restore focus after the exchange sheet closes without scrolling the page. */
export function restoreSheetFocus(
  opener: HTMLElement | null,
  fallback: HTMLElement | null,
): HTMLElement | null {
  const tryFocus = (el: HTMLElement | null): HTMLElement | null => {
    if (!el?.isConnected || typeof el.focus !== "function") {
      return null;
    }
    el.focus({ preventScroll: true });
    return el;
  };

  return tryFocus(opener) ?? tryFocus(fallback);
}

export function captureSheetOpener(
  eventTarget: EventTarget | null,
): HTMLElement | null {
  if (eventTarget instanceof HTMLElement) {
    return eventTarget;
  }
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : null;
}
