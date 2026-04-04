import Link from "next/link";
import { Button } from "@typ-nique/ui";

export function Hero() {
  return (
    <section className="flex min-h-[68vh] items-center">
      <div className="space-y-8">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Typst Speed Game</p>
        <h1 className="max-w-4xl text-5xl font-semibold leading-[1] tracking-tight text-white sm:text-6xl">
          Rebuild rendered Typst snippets.
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/play">
            <Button className="px-6 py-3 text-base">Play</Button>
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center rounded-full border border-white/12 px-6 py-3 text-base font-medium text-white transition hover:bg-white/8"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </section>
  );
}
