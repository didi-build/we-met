export const CHIPS_OPENED_STORAGE_KEY = "card-chips-opened";

export type ChipPopoverPosition = {
  left: number;
  top: number;
  w: number;
  above: boolean;
  arrowX: number;
};

const VIEWPORT_MARGIN = 16;
const CHIP_GAP = 10;
const MAX_WIDTH = 280;
const ARROW_EDGE_MARGIN = 20;

export function measureChipPopoverPosition(args: {
  chipRect: DOMRect;
  rootRect: DOMRect;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}): ChipPopoverPosition {
  const { chipRect, rootRect, popoverHeight, viewportWidth, viewportHeight } = args;
  const w = Math.min(MAX_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
  const cx = chipRect.left + chipRect.width / 2;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(cx - w / 2, viewportWidth - VIEWPORT_MARGIN - w),
  );
  const fitsBelow =
    chipRect.bottom + CHIP_GAP + popoverHeight <= viewportHeight - VIEWPORT_MARGIN;
  const fitsAbove = chipRect.top - CHIP_GAP - popoverHeight >= VIEWPORT_MARGIN;
  const above = !fitsBelow && fitsAbove;
  const topViewport = above
    ? chipRect.top - CHIP_GAP - popoverHeight
    : chipRect.bottom + CHIP_GAP;
  const arrowX = Math.max(
    ARROW_EDGE_MARGIN,
    Math.min(cx - left, w - ARROW_EDGE_MARGIN),
  );

  return {
    left: Math.round(left - rootRect.left),
    top: Math.round(topViewport - rootRect.top),
    w: Math.round(w),
    above,
    arrowX: Math.round(arrowX),
  };
}
