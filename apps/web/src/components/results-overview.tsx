import type { GameSessionResult } from "@typ-nique/types";
import { Card } from "@typ-nique/ui";

export function ResultsOverview({ result }: { result: GameSessionResult }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
      <Card className="space-y-5">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Run complete</p>
        <div>
          <p className="text-6xl font-semibold tracking-tight">{result.score}</p>
          <p className="mt-2 text-slate-300">
            {result.solvedCount} solved with {Math.round(result.accuracy * 100)}% accuracy across {result.attemptedCount} attempts.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Solved" value={String(result.solvedCount)} />
          <StatCard label="Attempts" value={String(result.attemptedCount)} />
          <StatCard label="Accuracy" value={`${Math.round(result.accuracy * 100)}%`} />
          <StatCard label="Duration" value={`${Math.round(result.durationMs / 1000)}s`} />
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Round review</h2>
          <p className="text-sm text-slate-400">Per-problem breakdown</p>
        </div>
        <div className="mt-4 space-y-3">
          {result.rounds.map((round) => (
            <div key={round.roundId} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{round.challengeTitle}</p>
                  <p className="text-sm text-slate-400">
                    {round.verdict} via {round.matchTier}
                  </p>
                </div>
                <p className="text-lg font-semibold">{round.scoreAwarded}</p>
              </div>
              {round.feedback ? <p className="mt-2 text-sm text-slate-300">{round.feedback}</p> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
