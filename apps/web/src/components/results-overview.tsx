import Link from "next/link";
import type { GameSessionResult, PersonalLeaderboardResponse } from "@typ-nique/types";
import { Button, Card } from "@typ-nique/ui";

export function ResultsOverview({
  result,
  personal
}: {
  result: GameSessionResult;
  personal: PersonalLeaderboardResponse | null;
}) {
  const topRound = [...result.rounds].sort((left, right) => right.scoreAwarded - left.scoreAwarded)[0];
  const solvedRate = Math.round(result.accuracy * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <Card className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Run Summary</p>
            <p className="text-6xl font-semibold tracking-tight text-white">{result.score}</p>
            <p className="max-w-md text-base leading-7 text-slate-300">
              {result.solvedCount} solved, {result.attemptedCount} attempted, and {solvedRate}% accuracy across the full session.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat label="Solved" value={String(result.solvedCount)} />
            <ResultStat label="Attempts" value={String(result.attemptedCount)} />
            <ResultStat label="Accuracy" value={`${solvedRate}%`} />
            <ResultStat label="Window" value={`${Math.round(result.durationMs / 60000)} min`} />
          </div>

          <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Best Round</p>
            <p className="mt-2 text-lg font-semibold text-white">{topRound?.challengeTitle ?? "No completed rounds yet"}</p>
            <p className="mt-1 text-sm text-slate-400">
              {topRound ? `${topRound.scoreAwarded} points • ${topRound.verdict} via ${topRound.matchTier}` : "Finish a run to surface standout prompts here."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/play">
              <Button className="px-6 py-3 text-base">Play Again</Button>
            </Link>
            <Link
              href={`/leaderboard?scope=daily&runId=${result.id}`}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              View Leaderboards
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Per-problem breakdown</h2>
              <p className="mt-1 text-sm text-slate-400">Every round, verdict, and score swing from the session.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {result.rounds.map((round) => (
              <div key={round.roundId} className="rounded-[24px] border border-white/8 bg-white/5 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{round.position}. {round.challengeTitle}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {round.verdict} via {round.matchTier} • {round.difficulty}
                    </p>
                  </div>
                  <div className="rounded-full bg-cyan-300/10 px-3 py-1 text-sm font-medium text-cyan-200">
                    +{round.scoreAwarded}
                  </div>
                </div>
                {round.feedback ? <p className="mt-3 text-sm leading-6 text-slate-300">{round.feedback}</p> : null}
                {round.submittedSource ? (
                  <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/70 p-3 font-[var(--font-mono)] text-xs text-slate-300">
                    {round.submittedSource}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RunsPanel
          title="Best Personal Scores"
          description={
            personal
              ? personal.guestMode
                ? "Guest history is scoped to this guest identity for now."
                : "Your strongest completed runs."
              : "Personal history is unavailable for this run."
          }
          runs={personal?.bestScores ?? []}
          emptyLabel="No personal best history available yet."
        />
        <RunsPanel
          title="Recent Runs"
          description="A practical recap of your latest finishes."
          runs={personal?.recentRuns ?? []}
          emptyLabel="No recent run history available yet."
        />
      </div>
    </div>
  );
}

function RunsPanel({
  title,
  description,
  runs,
  emptyLabel
}: {
  title: string;
  description: string;
  runs: PersonalLeaderboardResponse["recentRuns"];
  emptyLabel: string;
}) {
  return (
    <Card>
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="mt-5 space-y-3">
        {runs.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          runs.map((run) => (
            <Link
              key={run.runId}
              href={`/results/${run.runId}`}
              className="block rounded-[24px] border border-white/8 bg-white/5 px-4 py-4 transition hover:bg-white/8"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{run.label}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {run.solvedCount} solved • {Math.round(run.accuracy * 100)}% accuracy
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-cyan-200">{run.score}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Score</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
