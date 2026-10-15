import Link from "next/link";
import { forwardRef, type ComponentProps, type Ref } from "react";

type Variant = "primary" | "outline";

const base =
  "inline-flex min-h-11 items-center justify-center gap-3 whitespace-nowrap rounded-pill px-7 font-semibold transition-[background-color,color] duration-[120ms] ease-[cubic-bezier(.4,0,.2,1)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink",
  outline:
    "border-[1.5px] border-ink bg-transparent text-ink no-underline hover:bg-ink hover:text-bg",
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    className = "",
    ...props
  }: ComponentProps<"button"> & { variant?: Variant },
  ref: Ref<HTMLButtonElement>,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
Button.displayName = "Button";

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
