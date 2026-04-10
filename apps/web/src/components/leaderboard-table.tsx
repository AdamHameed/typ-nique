"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeaderboardResponse, PersonalLeaderboardResponse } from "@typ-nique/types";
import { Card } from "@typ-nique/ui";
import { getCurrentPersonalLeaderboards } from "../lib/api";

export function LeaderboardTable({
  board,
  personal
}: {
  board: LeaderboardResponse;
  personal: PersonalLeaderboardResponse | null;
}) {
  const [currentPersonal, setCurrentPersonal] = useState<PersonalLeaderboardResponse | null>(personal);
  const [personalStatus, setPersonalStatus] = useState<"idle" | "loading" | "ready" | "error">(personal ? "ready" : "idle");

  useEffect(() => {
    setCurrentPersonal(personal);
    setPersonalStatus(personal ? "ready" : "idle");
  }, [personal]);

  useEffect(() => {
    if (personal) {
      return;
    }

    let cancelled = false;
    setPersonalStatus("loading");

    void getCurrentPersonalLeaderboards(5)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setCurrentPersonal(response.data);
        setPersonalStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setPersonalStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [personal]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-4xl font-semibold text-[var(--text)]">{getLeaderboardHeading(board.scope)}</h2>
              <p className="mt-2 texnique-note">
                Ranked by score, then earlier finish time. Guests are shown with anonymized labels.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link
                  href="/leaderboard?scope=weekly"
                  className={getScopeLinkClass(board.scope === "weekly")}
                >
                  Weekly
                </Link>
                <Link
                  href="/leaderboard?scope=global"
                  className={getScopeLinkClass(board.scope === "global")}
                >
                  All Time
                </Link>
              </div>
            </div>
            {/* <div className="border-2 border-[color:var(--text)] px-3 py-1 text-sm text-[var(--muted)]">
              {getScopeLabel(board.scope)}
            </div> */}
          </div>

          <div className="texnique-table-wrap mt-6">
            <table className="texnique-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th> 
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Solved</th>
                  <th>Finished</th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((entry) => (
                  <tr key={entry.runId}>
                    <td className="text-[var(--muted)]">{entry.rank}</td>
                    <td>
                      <div className="font-medium text-[var(--text)]">{entry.userName}</div>
                      <div className="text-xs text-[var(--muted)]">{entry.isGuest ? "Guest run" : "Registered player"}</div>
                    </td>
                    <td className="text-[var(--text)]">{entry.score}</td>
                    <td>{Math.round(entry.accuracy * 100)}%</td>
                    <td>{entry.solvedCount ?? 0}</td>
                    <td className="text-[var(--muted)]">{entry.createdAt}</td>
                  </tr>
                ))}
                {board.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-[var(--muted)]">
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
              currentPersonal
                ? currentPersonal.guestMode
                  ? "Guest history is scoped to the current guest session for now."
                  : "Your strongest completed runs, ready for quick comparison."
                : personalStatus === "loading"
                  ? "Loading personal history for this browser session."
                  : "Your best runs for the current account or guest session."
            }
            runs={currentPersonal?.bestScores ?? []}
            emptyLabel={personalStatus === "error" ? "Personal history is unavailable right now." : "No personal bests available yet."}
          />
          <LeaderboardRunsCard
            title="Recent Runs"
            description="A compact history of the latest completed runs for this player or guest session."
            runs={currentPersonal?.recentRuns ?? []}
            emptyLabel={personalStatus === "error" ? "Recent run history is unavailable right now." : "No recent runs available yet."}
          />
        </div>
      </div>
    </div>
  );
}

function getLeaderboardHeading(scope: LeaderboardResponse["scope"]) {
  if (scope === "global") {
    return "Highest All-Time Scores";
  }

  if (scope === "daily") {
    return "Highest Daily Scores";
  }

  return "Highest Weekly Scores";
}

function getScopeLabel(scope: LeaderboardResponse["scope"]) {
  if (scope === "global") {
    return "All time";
  }

  return scope;
}

function getScopeLinkClass(active: boolean) {
  return active
    ? "border-2 border-[color:var(--text)] px-3 py-1 text-[var(--text)]"
    : "border-2 border-transparent px-3 py-1 text-[var(--muted)] transition hover:border-[color:var(--line)] hover:text-[var(--text)]";
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
        <h2 className="text-3xl font-semibold text-[var(--text)]">{title}</h2>
        <p className="mt-2 texnique-note">{description}</p>
      </div>

      <div className="mt-5 texnique-list">
        {runs.length === 0 ? (
          <div className="texnique-note">
            {emptyLabel}
          </div>
        ) : (
          runs.map((run) => (
            <Link
              key={run.runId}
              href={`/results/${run.runId}`}
              className="texnique-list-item block"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-medium text-[var(--text)]">{run.label}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {run.solvedCount} solved • {Math.round(run.accuracy * 100)}% accuracy
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-[var(--text)]">{run.score}</p>
                  <p className="text-sm text-[var(--muted)]">Score</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
