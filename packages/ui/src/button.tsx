import { clsx } from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button({
  className,
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[color:var(--text)]/70 focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]",
        "bg-[var(--button-bg)] text-[var(--button-text)] hover:-translate-y-0.5 hover:bg-[var(--button-hover)]",
        "disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
