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
        "rounded-[28px] border border-white/10 bg-[rgba(7,15,29,0.8)] p-6 shadow-[0_30px_100px_rgba(2,8,20,0.4)] backdrop-blur-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
