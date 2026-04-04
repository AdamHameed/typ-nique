import Link from "next/link";
import type { LeaderboardResponse, PersonalLeaderboardResponse } from "@typ-nique/types";
import { Card } from "@typ-nique/ui";

export function LeaderboardTable({
  board,
  personal,
  activeScope
}: {
  board: LeaderboardResponse;
  personal: PersonalLeaderboardResponse | null;
  activeScope: "global" | "daily" | "weekly";
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {(["global", "daily", "weekly"] as const).map((scope) => (
          <Link
            key={scope}
            href={`/leaderboard?scope=${scope}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              scope === activeScope
                ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {scope[0]!.toUpperCase() + scope.slice(1)}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">{board.label}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Ranked by score, then earlier finish time. Guests are shown with anonymized labels.
              </p>
            </div>
            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-200">
              {board.scope}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[26px] border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/6 text-slate-400">
                <tr>
                  <th className="px-5 py-4">Rank</th>
                  <th className="px-5 py-4">Player</th>
                  <th className="px-5 py-4">Score</th>
                  <th className="px-5 py-4">Accuracy</th>
                  <th className="px-5 py-4">Solved</th>
                  <th className="px-5 py-4">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 bg-[rgba(255,255,255,0.02)]">
                {board.entries.map((entry) => (
                  <tr key={entry.runId} className="transition hover:bg-white/5">
                    <td className="px-5 py-4 text-slate-500">{entry.rank}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{entry.userName}</div>
                      <div className="text-xs text-slate-500">{entry.isGuest ? "Guest run" : "Registered player"}</div>
                    </td>
                    <td className="px-5 py-4 text-cyan-200">{entry.score}</td>
                    <td className="px-5 py-4">{Math.round(entry.accuracy * 100)}%</td>
                    <td className="px-5 py-4">{entry.solvedCount ?? 0}</td>
                    <td className="px-5 py-4 text-slate-500">{entry.createdAt}</td>
                  </tr>
                ))}
                {board.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      No completed runs have landed on this board yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <LeaderboardRunsCard
            title="Best Personal Scores"
            description={
              personal
                ? personal.guestMode
                  ? "Guest history is scoped to the current guest session for now."
                  : "Your strongest completed runs, ready for quick comparison."
                : "Open a run result to load personal bests here."
            }
            runs={personal?.bestScores ?? []}
            emptyLabel="No personal bests available yet."
          />
          <LeaderboardRunsCard
            title="Recent Runs"
            description="A compact history of the latest completed runs for this player or guest session."
            runs={personal?.recentRuns ?? []}
            emptyLabel="No recent runs available yet."
          />
        </div>
      </div>
    </div>
  );
}

function LeaderboardRunsCard({
  title,
  description,
  runs,
  emptyLabel
}: {
  title: string;
  description: string;
  runs: PersonalLeaderboardResponse["bestScores"];
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
