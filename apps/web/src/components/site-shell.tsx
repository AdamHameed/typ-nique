import Link from "next/link";
import type { PropsWithChildren } from "react";

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-grid">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Typ-Nique
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-300">
            <Link href="/play">Play</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/results/demo">Results</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
