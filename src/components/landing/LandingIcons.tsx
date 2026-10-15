import { DidiBuildLeafIcon, WeMetMarkIcon } from "@/components/hi/icons/HiCardIcons";
import type { ReactNode } from "react";

type IconProps = {
  size: number;
  className?: string;
};

export function LandingIcon({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <span className={`lp-icon ${className ?? ""}`.trim()}>{children}</span>;
}

export { DidiBuildLeafIcon, WeMetMarkIcon };

export function CopyIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

export function ContactCardIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 14h3" />
    </svg>
  );
}

export function SunIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
    </svg>
  );
}

export function QrSampleIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 21 21"
      fill="currentColor"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect
        x="0.5"
        y="0.5"
        width="6"
        height="6"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x="2" y="2" width="3" height="3" rx="0.6" />
      <rect
        x="14.5"
        y="0.5"
        width="6"
        height="6"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x="16" y="2" width="3" height="3" rx="0.6" />
      <rect
        x="0.5"
        y="14.5"
        width="6"
        height="6"
        rx="1.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x="2" y="16" width="3" height="3" rx="0.6" />
      <path d="M8 0h1v1h-1zM7 1h1v1h-1zM8 1h1v1h-1zM11 1h1v1h-1zM12 1h1v1h-1zM9 2h1v1h-1zM11 2h1v1h-1zM8 3h1v1h-1zM9 3h1v1h-1zM12 3h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM12 4h1v1h-1zM8 5h1v1h-1zM11 5h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM13 6h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM9 7h1v1h-1zM10 7h1v1h-1zM11 7h1v1h-1zM16 7h1v1h-1zM0 8h1v1h-1zM3 8h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM9 8h1v1h-1zM10 8h1v1h-1zM16 8h1v1h-1zM17 8h1v1h-1zM19 8h1v1h-1zM1 9h1v1h-1zM4 9h1v1h-1zM6 9h1v1h-1zM7 9h1v1h-1zM10 9h1v1h-1zM11 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM20 9h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM16 10h1v1h-1zM20 10h1v1h-1zM6 11h1v1h-1zM8 11h1v1h-1zM10 11h1v1h-1zM11 11h1v1h-1zM12 11h1v1h-1zM16 11h1v1h-1zM1 12h1v1h-1zM4 12h1v1h-1zM5 12h1v1h-1zM6 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM12 12h1v1h-1zM13 12h1v1h-1zM15 12h1v1h-1zM16 12h1v1h-1zM19 12h1v1h-1zM20 12h1v1h-1zM0 13h1v1h-1zM1 13h1v1h-1zM2 13h1v1h-1zM3 13h1v1h-1zM4 13h1v1h-1zM7 13h1v1h-1zM8 13h1v1h-1zM9 13h1v1h-1zM11 13h1v1h-1zM12 13h1v1h-1zM15 13h1v1h-1zM16 13h1v1h-1zM20 13h1v1h-1zM7 14h1v1h-1zM9 14h1v1h-1zM12 14h1v1h-1zM15 14h1v1h-1zM20 14h1v1h-1zM8 15h1v1h-1zM10 15h1v1h-1zM11 15h1v1h-1zM13 15h1v1h-1zM17 15h1v1h-1zM18 15h1v1h-1zM14 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM10 17h1v1h-1zM11 17h1v1h-1zM13 17h1v1h-1zM17 17h1v1h-1zM20 17h1v1h-1zM7 18h1v1h-1zM8 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM16 18h1v1h-1zM17 18h1v1h-1zM18 18h1v1h-1zM9 19h1v1h-1zM10 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM16 19h1v1h-1zM17 19h1v1h-1zM18 19h1v1h-1zM7 20h1v1h-1zM8 20h1v1h-1zM11 20h1v1h-1zM12 20h1v1h-1zM13 20h1v1h-1zM14 20h1v1h-1zM15 20h1v1h-1zM20 20h1v1h-1z" />
    </svg>
  );
}
