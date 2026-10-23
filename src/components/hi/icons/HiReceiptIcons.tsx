import type { ReactNode } from "react";

type IconProps = {
  size?: number;
  className?: string;
};

function strokeIcon(size: number, className: string | undefined, children: ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function HiCheckIcon({ size = 18, className }: IconProps) {
  return strokeIcon(size, className, <path d="M5 12.5l4.5 4.5L19 7.5" />);
}

export function HiMailIcon({ size = 18, className }: IconProps) {
  return strokeIcon(
    size,
    className,
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </>,
  );
}

export function HiPhoneIcon({ size = 18, className }: IconProps) {
  return strokeIcon(
    size,
    className,
    <path d="M6.6 3.5h2.6l1.4 4-2 1.3a12 12 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />,
  );
}

export function HiContactCardIcon({ size = 18, className }: IconProps) {
  return strokeIcon(
    size,
    className,
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <circle cx="12" cy="10.5" r="2.6" />
      <path d="M7.5 17a4.8 4.8 0 0 1 9 0" />
    </>,
  );
}

export function HiNoteIcon({ size = 18, className }: IconProps) {
  return strokeIcon(
    size,
    className,
    <>
      <path d="M7 4h10a2 2 0 0 1 2 2v14l-4-3H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M9 9h6M9 12.5h4" />
    </>,
  );
}
