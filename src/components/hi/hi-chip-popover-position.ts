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

export type ChipPopoverBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function measureChipPopoverPosition(args: {
  chipRect: DOMRect;
  rootRect: DOMRect;
  popoverHeight: number;
  bounds: ChipPopoverBounds;
}): ChipPopoverPosition {
  const { chipRect, rootRect, popoverHeight, bounds } = args;
  const w = Math.min(MAX_WIDTH, bounds.width - VIEWPORT_MARGIN * 2);
  const boundsRight = bounds.left + bounds.width;
  const boundsBottom = bounds.top + bounds.height;
  const cx = chipRect.left + chipRect.width / 2;
  const left = Math.max(
    bounds.left + VIEWPORT_MARGIN,
    Math.min(cx - w / 2, boundsRight - VIEWPORT_MARGIN - w),
  );
  const fitsBelow =
    chipRect.bottom + CHIP_GAP + popoverHeight <= boundsBottom - VIEWPORT_MARGIN;
  const fitsAbove =
    chipRect.top - CHIP_GAP - popoverHeight >= bounds.top + VIEWPORT_MARGIN;
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
