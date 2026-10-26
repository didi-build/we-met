import type { ComponentProps, ReactNode } from "react";
import "./we-met-button.css";

type Variant = "primary" | "outline";

export type WeMetButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  children: ReactNode;
};

export function WeMetButton({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: WeMetButtonProps) {
  return (
    <button
      type={type}
      className={`we-met-button we-met-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
