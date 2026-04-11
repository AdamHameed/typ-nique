"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MultiplayerRoomReplayData } from "@typ-nique/types";
import { Button, Card } from "@typ-nique/ui";
import { getMultiplayerRoomResults } from "../lib/api";
import { multiplayerDiagnosticsEnabled } from "../lib/runtime-flags";

export function MultiplayerResultsClient({
  matchId,
  includeDiagnostics = false
}: {
  matchId: string;
  includeDiagnostics?: boolean;
}) {
  const [data, setData] = useState<MultiplayerRoomReplayData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      const response = await getMultiplayerRoomResults(matchId, includeDiagnostics).catch(() => null);

      if (cancelled) {
        return;
      }

      if (!response?.data) {
        setStatus("error");
        return;
      }

      setData(response.data);
      setStatus("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [includeDiagnostics, matchId]);

  if (status === "loading") {
    return <p className="texnique-note">Loading multiplayer results...</p>;
  }

  if (status === "error" || !data) {
    return <p className="texnique-note">Multiplayer results not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.86fr,1.14fr]">
        <Card className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">Race summary</p>
            <p className="text-4xl font-semibold tracking-tight text-[var(--text)]">Room {data.room.roomCode}</p>
            <p className="texnique-note">
              Final placements, round outcomes, and room-level race timing for this multiplayer session.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResultStat label="Players" value={String(data.players.length)} />
            <ResultStat label="Race length" value={`${data.room.durationMinutes} min`} />
            <ResultStat label="Status" value={data.room.status} />
            <ResultStat label="Started round" value={String(data.room.startedRoundIndex)} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/multiplayer/rooms/${data.room.roomCode}`}>
              <Button className="px-6 py-3 text-base">Back To Room</Button>
            </Link>
            <Link href="/multiplayer">
              <Button className="px-6 py-3 text-base">More Races</Button>
            </Link>
            {multiplayerDiagnosticsEnabled ? (
              <Link href={`/multiplayer/results/${matchId}?view=debug`}>
                <Button className="px-6 py-3 text-base">Diagnostics</Button>
              </Link>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="text-3xl font-semibold text-[var(--text)]">Final placements</h2>
            <p className="mt-2 texnique-note">Player-facing replay with scores, solved rounds, timing, and per-round outcomes.</p>
          </div>

          <div className="texnique-list">
            {data.players.map((player) => (
              <div key={player.playerId} className="texnique-list-item">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-medium text-[var(--text)]">
                      #{player.finalPlace ?? "--"} {player.displayName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {player.solvedCount} solved · {player.score} points · {player.currentRoundNumber} rounds seen
                    </p>
                  </div>
                  <div className="text-right text-sm text-[var(--muted)]">
                    <p>{Math.round(player.accuracy * 100)}% accuracy</p>
                    <p>{formatDuration(player.durationMs)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <ResultStat label="Score" value={String(player.score)} />
                  <ResultStat label="Solved" value={String(player.solvedCount)} />
                  <ResultStat label="Attempts" value={String(player.attemptedCount)} />
                  <ResultStat label="Finished" value={player.finishedAt ? formatTimestamp(player.finishedAt) : "In progress"} />
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">Round breakdown</summary>
                  <div className="mt-3 space-y-3">
                    {player.rounds.map((round) => (
                      <div key={round.roundId} className="border border-[color:var(--line)] px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-[var(--text)]">
                              {round.position}. {round.challengeTitle}
                            </p>
                            <p className="text-sm text-[var(--muted)]">
                              {round.verdict} via {round.matchTier} · {round.difficulty}
                            </p>
                          </div>
                          <div className="text-sm text-[var(--muted)]">+{round.scoreAwarded}</div>
                        </div>
                        {round.feedback ? <p className="mt-2 text-sm text-[var(--muted)]">{round.feedback}</p> : null}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {multiplayerDiagnosticsEnabled && includeDiagnostics && data.diagnostics ? (
        <Card className="space-y-5">
          <div>
            <p className="text-sm text-[var(--muted)]">Developer diagnostics</p>
            <h2 className="text-3xl font-semibold text-[var(--text)]">Race progression debug view</h2>
            <p className="mt-2 texnique-note">Operational details derived from persisted room/session state. Kept separate from the player replay above.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Room version" value={String(data.diagnostics.roomVersion)} />
            <ResultStat label="Room status" value={data.diagnostics.roomStatus} />
            <ResultStat label="Generated" value={formatTimestamp(data.diagnostics.generatedAt)} />
          </div>

          <div className="texnique-list">
            {data.diagnostics.diagnosticsPlayers.map((player) => (
              <div key={player.playerId} className="texnique-list-item">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-medium text-[var(--text)]">{player.displayName}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      session {player.gameSessionId ?? "none"} · {player.connectionStatus} · {player.sessionStatus}
                    </p>
                  </div>
                  <div className="text-right text-sm text-[var(--muted)]">
                    <p>place {player.finalPlace ?? "--"}</p>
                    <p>round {player.currentRoundNumber}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <ResultStat label="Joined" value={formatTimestamp(player.joinedAt)} />
                  <ResultStat label="Ready" value={player.readyAt ? formatTimestamp(player.readyAt) : "No"} />
                  <ResultStat label="Heartbeat" value={player.lastHeartbeatAt ? formatTimestamp(player.lastHeartbeatAt) : "Unknown"} />
                  <ResultStat label="Finished" value={player.finishedAt ? formatTimestamp(player.finishedAt) : "No"} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="texnique-list-item">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}

function formatDuration(durationMs: number | null) {
  if (!durationMs) {
    return "n/a";
  }

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}
