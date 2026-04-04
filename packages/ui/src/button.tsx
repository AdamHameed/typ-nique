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
        "focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-slate-950",
        "bg-cyan-300 text-slate-950 shadow-[0_12px_32px_rgba(95,225,255,0.28)] hover:-translate-y-0.5 hover:bg-cyan-200",
        "disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
