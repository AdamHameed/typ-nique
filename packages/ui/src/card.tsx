import { clsx } from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={clsx(
        "border-2 border-[color:var(--text)] bg-[var(--render-surface)] p-5",
        "text-[var(--text)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
