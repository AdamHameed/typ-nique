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
                ? "border-[color:var(--line-strong)] bg-[var(--panel-strong)] text-[var(--text)]"
                : "border-[color:var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--panel-strong)]"
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
              <h2 className="text-2xl font-semibold text-[var(--text)]">{board.label}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Ranked by score, then earlier finish time. Guests are shown with anonymized labels.
              </p>
            </div>
            <div className="rounded-full border border-[color:var(--line)] bg-[var(--panel-strong)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              {board.scope}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[26px] border border-[color:var(--line)]">
            <table className="min-w-full divide-y divide-[color:var(--line)] text-left text-sm">
              <thead className="bg-[var(--panel-strong)] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-4">Rank</th>
                  <th className="px-5 py-4">Player</th>
                  <th className="px-5 py-4">Score</th>
                  <th className="px-5 py-4">Accuracy</th>
                  <th className="px-5 py-4">Solved</th>
                  <th className="px-5 py-4">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)] bg-[var(--panel)]">
                {board.entries.map((entry) => (
                  <tr key={entry.runId} className="transition hover:bg-[var(--panel-strong)]">
                    <td className="px-5 py-4 text-[var(--muted)]">{entry.rank}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-[var(--text)]">{entry.userName}</div>
                      <div className="text-xs text-[var(--muted)]">{entry.isGuest ? "Guest run" : "Registered player"}</div>
                    </td>
                    <td className="px-5 py-4 text-[var(--text)]">{entry.score}</td>
                    <td className="px-5 py-4">{Math.round(entry.accuracy * 100)}%</td>
                    <td className="px-5 py-4">{entry.solvedCount ?? 0}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{entry.createdAt}</td>
                  </tr>
                ))}
                {board.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-[var(--muted)]">
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
        <h2 className="text-2xl font-semibold text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      </div>

      <div className="mt-5 space-y-3">
        {runs.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[color:var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
            {emptyLabel}
          </div>
        ) : (
          runs.map((run) => (
            <Link
              key={run.runId}
              href={`/results/${run.runId}`}
              className="block rounded-[24px] border border-[color:var(--line)] bg-[var(--panel-strong)] px-4 py-4 transition hover:bg-[var(--panel)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--text)]">{run.label}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {run.solvedCount} solved • {Math.round(run.accuracy * 100)}% accuracy
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--text)]">{run.score}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Score</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
