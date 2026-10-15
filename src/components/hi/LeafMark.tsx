type LeafMarkProps = {
  size?: number;
};

/** Didi Build design-system LeafMark (ported from design/_ds LeafMark.jsx). */
export function LeafMark({ size = 12 }: LeafMarkProps) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 bg-accent"
      style={{
        width: size,
        height: size,
        borderRadius: `${size}px 2px ${size}px 2px`,
      }}
    />
  );
}
