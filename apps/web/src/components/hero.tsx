import Link from "next/link";
import { Button, Card } from "@typ-nique/ui";

export function Hero() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-6">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Competitive Typst</p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white">
          Race to reconstruct rendered Typst snippets with speed, accuracy, and style.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-300">
          Typ-Nique turns typesetting fluency into a polished challenge loop. Match canonical
          source, land equivalent renders, build streaks, and chase leaderboard runs.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/play">
            <Button>Start a Run</Button>
          </Link>
          <Link href="/leaderboard" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">
            View Leaders
          </Link>
        </div>
      </div>
      <Card className="space-y-4">
        <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Rendered target</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900 p-4 font-mono text-lg">
            <p className="text-slate-100">$ integral_0^1 x^2 dif x $</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Accepted answer tiers</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>1. Exact source match</li>
            <li>2. Normalized source match</li>
            <li>3. Rendered SVG equivalence</li>
            <li>4. Approved alternate answer</li>
          </ul>
        </div>
      </Card>
    </section>
  );
}
