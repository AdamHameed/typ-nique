import Link from "next/link";
import type { PropsWithChildren } from "react";

const navItems = [
  { href: "/play", label: "Play" },
  { href: "/daily", label: "Daily" },
  { href: "/leaderboard", label: "Leaderboard" }
] as const;

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[rgba(4,10,19,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-200">
              T
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-white">Typ-Nique</p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Competitive Typst</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/6 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
