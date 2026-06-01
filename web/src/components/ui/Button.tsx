import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 shadow-sm",
  secondary:
    "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 active:bg-neutral-100",
  ghost:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", size = "md", className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:pointer-events-none",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
      />
    );
  },
);
