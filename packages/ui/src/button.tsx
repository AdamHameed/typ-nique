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
        "inline-flex items-center justify-center border-2 border-[color:var(--text)] bg-[var(--render-surface)] px-4 py-2 text-base font-normal text-[var(--text)] transition",
        "focus:outline-none focus:bg-[var(--panel)]",
        "hover:bg-[var(--panel-strong)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
