import Link from "next/link";
import { Button } from "@typ-nique/ui";
import { featureFlags } from "../lib/features";

export function Hero() {
  return (
    <section className="py-8 text-center">
      <p className="texnique-title">Typ-Nique</p>
      <p className="texnique-subtitle">A Typst Typesetting Game</p>
      <p className="mx-auto max-w-2xl text-base leading-7 text-[var(--muted)]">
        Rebuild rendered Typst snippets from scratch, race the clock, and compare your sessions on shared boards.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/play">
          <Button className="px-6 py-3 text-base">Play</Button>
        </Link>
        {featureFlags.dailyMode ? (
          <Link href="/daily">
            <Button className="px-6 py-3 text-base">Daily</Button>
          </Link>
        ) : null}
        <Link href="/leaderboard">
          <Button className="px-6 py-3 text-base">Leaderboard</Button>
        </Link>
      </div>
      <p className="mx-auto mt-8 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        Clean math displays, dark-source input, and fast rounds inspired by the original TeXnique feel.
      </p>
    </section>
  );
}
