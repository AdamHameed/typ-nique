import Link from "next/link";
import type { PropsWithChildren } from "react";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/play", label: "Play" },
  { href: "/daily", label: "Daily" },
  { href: "/leaderboard", label: "Leaderboard" }
] as const;

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-[color:var(--background)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-[var(--text)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--line-strong)] text-sm font-semibold">
              T
            </div>
            <p className="text-base font-semibold tracking-tight">Typ-Nique</p>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--text)]"
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
