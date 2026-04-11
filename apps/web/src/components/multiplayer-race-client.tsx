"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GameSessionState, MultiplayerRoomState } from "@typ-nique/types";
import { Button, Card } from "@typ-nique/ui";
import { getGameSession, skipRound, submitGameAnswer } from "../lib/api";
import { useRoundPlay } from "../hooks/use-round-play";
import { RoundPlayShell } from "./round-play-shell";

interface MultiplayerRaceClientProps {
  room: MultiplayerRoomState;
  hydratedSessionState: GameSessionState | null;
  onLeave: () => void;
  onBackToLobby: () => void;
  connectionState: "idle" | "connecting" | "live" | "reconnecting" | "offline";
}

export function MultiplayerRaceClient({ room, hydratedSessionState, onLeave, onBackToLobby, connectionState }: MultiplayerRaceClientProps) {
  const [session, setSession] = useState<GameSessionState | null>(hydratedSessionState);
  const pollingRef = useRef<number | null>(null);
  const localSessionId = room.localSessionId ?? hydratedSessionState?.id ?? null;
  const {
    source,
    status,
    fatalError,
    latestPreview,
    isPending,
    setSource,
    setStatus,
    setFatalError,
    setLatestPreview,
    handleSubmit,
    handleSkip,
    handleClearDraft
  } = useRoundPlay({
    session,
    initialStatus: "Syncing your race session...",
    autoSubmitStrategy: "multiplayer",
    onRefreshSession: refreshSession,
    onSubmitRound: async (input) => {
      const response = await submitGameAnswer(input);

      if (response.data.sessionState) {
        setSession(response.data.sessionState);
      }

      return response.data;
    },
    onSkipRound: async (input) => {
      const response = await skipRound(input);
      setSession(response.data);
      return response.data;
    }
  });

  useEffect(() => {
    if (hydratedSessionState) {
      setSession(hydratedSessionState);
      setFatalError(null);
    }
  }, [hydratedSessionState, setFatalError]);

  useEffect(() => {
    if (!localSessionId) {
      return;
    }

    if (hydratedSessionState?.id === localSessionId) {
      return;
    }

    void refreshSession(localSessionId, false);
  }, [hydratedSessionState?.id, localSessionId]);

  useEffect(() => {
    if (!localSessionId || room.status !== "active") {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }

      return;
    }

    pollingRef.current = window.setInterval(() => {
      void refreshSession(localSessionId, false);
    }, 1500);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
  }, [localSessionId, room.status]);

  const countdownLabel = useMemo(() => formatCountdown(room.countdownEndsAt), [room.countdownEndsAt]);
  const localPlayer = useMemo(
    () => room.players.find((player) => player.playerId === room.localPlayerId) ?? null,
    [room.localPlayerId, room.players]
  );
  const compactStandings = room.status === "completed" && room.finalPlacements.length > 0 ? room.finalPlacements : room.standings;

  async function refreshSession(sessionId: string, noisy = true) {
    const next = await getGameSession(sessionId).catch(() => null);

    if (!next?.data) {
      if (noisy) {
        setFatalError("Your race session could not be recovered.");
      }

      return;
    }

    setSession(next.data);
    setFatalError(null);

    if (noisy && next.data.lastResult?.feedback) {
      setStatus(next.data.lastResult.feedback);
    } else if (next.data.status === "completed") {
      setStatus("Finished. Waiting for the final placements to lock.");
    }
  }

  if (!localSessionId && !hydratedSessionState) {
    return (
      <Card className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Preparing Your Lane</p>
        <h2 className="text-2xl font-semibold">The room is live, but your player session is still syncing.</h2>
        <p className="text-sm leading-7 text-[var(--muted)]">Stay on this page. The server will rehydrate your player session from the persisted room state.</p>
      </Card>
    );
  }

  if (room.status === "completed") {
    return (
      <section className="mx-auto max-w-5xl space-y-6">
        <Card className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Race Complete</p>
          <h2 className="text-3xl font-semibold">Final placements are locked.</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">
            The room has finished. Reconnects will hydrate from the persisted final standings and replay data.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Your place" value={String(findLocalPlacement(room) ?? "--")} />
            <SummaryTile label="Your score" value={String(localPlayer?.score ?? 0)} />
            <SummaryTile label="Solved" value={String(localPlayer?.solvedCount ?? 0)} />
          </div>
          <div className="flex flex-wrap gap-3">
            {localPlayer?.isHost ? (
              <Button onClick={onBackToLobby} className="px-5 py-3 text-base">Back To Lobby</Button>
            ) : null}
            <Link href={`/multiplayer/results/${room.id}`}>
              <Button className="px-5 py-3 text-base">View Results</Button>
            </Link>
            <Button onClick={onLeave} className="px-5 py-3 text-base">Leave Room</Button>
          </div>
          {!localPlayer?.isHost ? (
            <p className="text-sm text-[var(--muted)]">Waiting for the host to reopen the lobby for the next race.</p>
          ) : null}
        </Card>
        <RaceSidebar room={room} />
      </section>
    );
  }

  if (room.status === "countdown") {
    return (
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Race Countdown</p>
          <h2 className="text-3xl font-semibold">Locked and syncing. Race starts in {countdownLabel}.</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">
            The challenge order is locked on the server. Stay on this page and the client will hydrate the first round as soon as the room turns active.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Place" value={String(findLocalPlacement(room) ?? "--")} />
            <SummaryTile label="Players" value={String(room.players.filter((player) => !player.leftAt).length)} />
            <SummaryTile label="Race length" value={`${room.durationMinutes} min`} />
          </div>
          <div className="rounded border border-[color:var(--line)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Connection</p>
            <p className="mt-2 text-sm">{labelConnectionState(connectionState)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/multiplayer/results/${room.id}`}>
              <Button className="px-5 py-3 text-base">View Results</Button>
            </Link>
            <Button onClick={onLeave} className="w-fit px-5 py-3 text-base">Leave Room</Button>
          </div>
        </Card>
        <RaceSidebar room={room} />
      </section>
    );
  }

  if (!session || session.status === "completed" || !session.currentRound) {
    return (
      <section className="mx-auto max-w-5xl space-y-6">
        <Card className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Finished Your Run</p>
          <h2 className="text-3xl font-semibold">Your race is done. Waiting for the room to settle final placements.</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">
            Countdown sync: {countdownLabel}. Live standings will keep updating from the server until the room completes.
          </p>
          <div className="rounded border border-[color:var(--line)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Connection</p>
            <p className="mt-2 text-sm">{labelConnectionState(connectionState)}</p>
          </div>
          <Button onClick={onLeave} className="w-fit px-5 py-3 text-base">Leave Room</Button>
        </Card>
        <RaceSidebar room={room} />
      </section>
    );
  }

  return (
    <RoundPlayShell
      session={session}
      source={source}
      status={status}
      fatalError={fatalError}
      latestPreview={latestPreview}
      title={`Room ${room.roomCode}`}
      subtitle="Live Multiplayer Race"
      finishLabel="Leave Race"
      onSourceChange={setSource}
      onSubmit={handleSubmit}
      onSkip={handleSkip}
      onFinish={onLeave}
      onClearDraft={handleClearDraft}
      onPreviewResult={setLatestPreview}
      isSubmitting={isPending}
      topMetrics={
        <>
          <p className="texnique-metric">
            <b>Place:</b> <span>{findLocalPlacement(room) ?? "--"}</span>
          </p>
          <p className="texnique-metric">
            <b>Solved:</b> <span>{localPlayer?.solvedCount ?? 0}</span>
          </p>
          <p className="texnique-metric">
            <b>Players:</b> <span>{room.players.filter((player) => !player.leftAt).length}</span>
          </p>
          <p className="texnique-metric">
            <b>Timer:</b> <span>{room.durationMinutes} min</span>
          </p>
        </>
      }
      afterEditor={
        <div className="mt-6">
          <StandingsPanel room={room} compact entries={compactStandings} />
        </div>
      }
    />
  );
}

function StandingsPanel({
  room,
  compact = false,
  entries
}: {
  room: MultiplayerRoomState;
  compact?: boolean;
  entries: MultiplayerRaceClientProps["room"]["standings"];
}) {
  return (
    <Card className={compact ? "mt-6 space-y-3" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Standings</p>
          <h3 className="text-xl font-semibold">{room.status === "completed" ? "Final placements" : "Live race order"}</h3>
        </div>
        <p className="text-sm text-[var(--muted)]">Room {room.roomCode}</p>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.playerId}
            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border border-[color:var(--line)] px-3 py-3 text-sm"
          >
            <span className="font-[var(--font-mono)] text-base">{entry.finalPlace ?? entry.rank}</span>
            <div>
              <p className="font-medium">
                {entry.displayName}
                {entry.isHost ? <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Host</span> : null}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {entry.solvedCount} solved · {entry.score} pts
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{entry.status}</span>
            <span className="font-[var(--font-mono)]">{Math.round(entry.accuracy * 100)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RaceSidebar({
  room
}: {
  room: MultiplayerRoomState;
}) {
  const entries = room.status === "completed" && room.finalPlacements.length > 0 ? room.finalPlacements : room.standings;

  return (
    <div>
      <StandingsPanel room={room} entries={entries} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[color:var(--line)] px-3 py-3">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function findLocalPlacement(room: MultiplayerRoomState) {
  if (!room.localPlayerId) {
    return null;
  }

  const standing = room.standings.find((entry) => entry.playerId === room.localPlayerId);
  return standing?.finalPlace ?? standing?.rank ?? null;
}

function formatCountdown(countdownEndsAt: string | null) {
  if (!countdownEndsAt) {
    return "live";
  }

  const remainingMs = Math.max(0, new Date(countdownEndsAt).getTime() - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return remainingSeconds > 0 ? `${remainingSeconds}s` : "live";
}

function labelConnectionState(connectionState: MultiplayerRaceClientProps["connectionState"]) {
  if (connectionState === "live") return "Live sync";
  if (connectionState === "reconnecting") return "Reconnecting";
  if (connectionState === "connecting") return "Connecting";
  if (connectionState === "offline") return "Offline";
  return "Idle";
}
