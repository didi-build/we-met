import type { ComponentProps, ReactNode } from "react";

/** Vite gallery build stub; app uses next/link in production. */
export default function Link({
  href,
  children,
  ...props
}: ComponentProps<"a"> & { href: string; children?: ReactNode }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
