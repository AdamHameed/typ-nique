import Link from "next/link";
import { Button, Card } from "@typ-nique/ui";

const features = [
  "Exact, normalized, alternate, and rendered-output checking",
  "Three-minute score runs with refresh-safe session state",
  "Daily challenge and leaderboard-ready architecture"
];

export function Hero() {
  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-7">
          <p className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-200">
            Typst Speed Game
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl">
              Rebuild rendered Typst snippets at full speed.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Typ-Nique is a dark, competitive typing game for people who want to internalize
              Typst syntax by feel. See the render, type the source, land the match, and keep the
              streak alive.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/play">
              <Button className="px-6 py-3 text-base">Start Run</Button>
            </Link>
            <Link
              href="/daily"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-white transition hover:bg-white/10"
            >
              Daily Challenge
            </Link>
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            {features.map((feature) => (
              <div key={feature} className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-4 text-sm text-slate-300">
                {feature}
              </div>
            ))}
          </div>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/8 bg-[rgba(5,12,24,0.88)] px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Example Round</p>
          </div>
          <div className="space-y-5 p-5">
            <div className="rounded-[24px] border border-cyan-300/15 bg-white px-5 py-6 text-slate-950">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-slate-500">Rendered Target</p>
              <div className="mt-5 rounded-2xl border border-slate-200 p-6 shadow-inner">
                <p className="font-[var(--font-mono)] text-2xl text-slate-900">$ sum_(i=1)^n i = n(n + 1)/2 $</p>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-5">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Source input</span>
                <span>Ctrl + Enter</span>
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/80 p-4 font-[var(--font-mono)] text-sm text-cyan-100">
                $sum_(i=1)^n i = n (n + 1) / 2$
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                <span>Accepted via normalized source match.</span>
                <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-cyan-200">+138 pts</span>
              </div>
            </div>
          </div>
        </Card>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <ProductCard title="Modern Checker" text="Not just string equality. Exact, normalized, alternate, and rendered SVG equivalence all count." />
        <ProductCard title="Fast Sessions" text="Three-minute runs, one prompt at a time, tuned for repetition and score-chasing." />
        <ProductCard title="Built To Grow" text="Daily challenges, leaderboards, and multiplayer-friendly backend primitives from the start." />
      </section>
    </div>
  );
}

function ProductCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className="space-y-3">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="text-sm leading-6 text-slate-300">{text}</p>
    </Card>
  );
}
