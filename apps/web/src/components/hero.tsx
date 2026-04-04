import Link from "next/link";
import { Button } from "@typ-nique/ui";

export function Hero() {
  return (
    <section className="flex min-h-[68vh] items-center">
      <div className="space-y-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Typst Speed Game</p>
        <h1 className="max-w-4xl text-5xl font-semibold leading-[1] tracking-tight text-[var(--text)] sm:text-6xl">
          Rebuild rendered Typst snippets.
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/play">
            <Button className="px-6 py-3 text-base">Play</Button>
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] px-6 py-3 text-base font-medium text-[var(--text)] transition hover:bg-[var(--panel)]"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </section>
  );
}
