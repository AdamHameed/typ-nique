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
        "rounded-[24px] border p-6",
        "border-[color:var(--line)] bg-[var(--panel)] text-[var(--text)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
