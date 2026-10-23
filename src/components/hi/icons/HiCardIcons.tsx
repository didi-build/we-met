"use client";

import { useId } from "react";

type IconProps = {
  size: number;
  className?: string;
};

export function WeMetMarkIcon({ size, className }: IconProps) {
  const maskId = useId();
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
    >
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <rect x="9.8" y="9" width="3.4" height="6.4" rx="1.7" fill="black" />
          <rect x="18.8" y="9" width="3.4" height="6.4" rx="1.7" fill="black" />
          <path
            d="M9.5 19.5Q16 26 22.5 19.5"
            fill="none"
            stroke="black"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function DidiBuildLeafIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="currentColor"
      className={className}
    >
      <path d="M10.286 0A1.714 1.714 0 0 1 12 1.714A10.286 10.286 0 0 1 1.714 12A1.714 1.714 0 0 1 0 10.286A10.286 10.286 0 0 1 10.286 0Z" />
    </svg>
  );
}

export function ArrowRightIcon({ size, className }: IconProps) {
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function WebsiteIcon({ size, className }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
    </svg>
  );
}

export function LinkedInIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.88 1.64-1.8 3.37-1.8 3.6 0 4.27 2.37 4.27 5.46v6.23zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export function GitHubIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .3a12 12 0 00-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 016 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 011.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0012 .3" />
    </svg>
  );
}

const RECEIPT_STROKE = 1.8;

export function HiReceiptCheckIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={RECEIPT_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function HiReceiptMailIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={RECEIPT_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function HiReceiptPhoneIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={RECEIPT_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6.5 4h3l1.5 5-2 1.5a11 11 0 005 5L17.5 14l5 1.5v3a2 2 0 01-2 2A15 15 0 014 6.5a2 2 0 012-2.5z" />
    </svg>
  );
}

export function HiReceiptContactIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={RECEIPT_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 8h14v12H5z" />
      <circle cx="12" cy="13" r="2.5" />
      <path d="M8 5h8v3H8z" />
    </svg>
  );
}

export function HiReceiptNoteIcon({ size, className }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={RECEIPT_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 6h12v14H7z" />
      <path d="M10 10h6M10 14h4" />
    </svg>
  );
}

export function InstagramIcon({ size, className }: IconProps) {
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
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}
