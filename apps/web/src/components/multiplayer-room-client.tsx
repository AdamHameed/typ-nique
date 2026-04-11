"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@typ-nique/ui";
import type { MultiplayerPlayerView, MultiplayerRoomPreview, MultiplayerRoomState } from "@typ-nique/types";
import { MultiplayerRaceClient } from "./multiplayer-race-client";
import { useMultiplayerRoom } from "../hooks/use-multiplayer-room";

export function MultiplayerRoomClient({ roomCode }: { roomCode: string }) {
  const {
    room,
    preview,
    hydratedSessionState,
    hydrationState,
    connectionState,
    error,
    isPending,
    join,
    leave,
    resetToLobby,
    toggleReady,
    startCountdown
  } = useMultiplayerRoom(roomCode);
  const [countdownMs, setCountdownMs] = useState(room?.countdownRemainingMs ?? 0);

  useEffect(() => {
    if (!room?.countdownEndsAt) {
      setCountdownMs(0);
      return;
    }

    const tick = () => {
      setCountdownMs(Math.max(0, new Date(room.countdownEndsAt!).getTime() - Date.now()));
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(interval);
    };
  }, [room?.countdownEndsAt]);

  const localPlayer = useMemo(
    () => room?.players.find((player) => player.playerId === room.localPlayerId) ?? null,
    [room?.localPlayerId, room?.players]
  );

  if (hydrationState === "loading") {
    return <RoomStatusCard title="Loading room..." body="Hydrating the room from persisted server state." />;
  }

  if (hydrationState === "error") {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <RoomStatusCard title="Room unavailable" body={error ?? "This room could not be loaded."} />
        <Link href="/multiplayer">
          <Button className="px-5 py-3 text-base">Back To Multiplayer</Button>
        </Link>
      </section>
    );
  }

  if (room && (room.status === "countdown" || room.status === "active" || room.status === "completed")) {
    return (
      <MultiplayerRaceClient
        room={room}
        hydratedSessionState={hydratedSessionState}
        onLeave={leave}
        onBackToLobby={resetToLobby}
        connectionState={connectionState}
      />
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Multiplayer Lobby</p>
            <h1 className="text-3xl font-semibold">Room {room?.roomCode ?? preview?.roomCode ?? roomCode}</h1>
            <p className="text-sm leading-7 text-[var(--muted)]">
              {room
                ? "Live room state is hydrated from the server and kept current over WebSocket."
                : "Preview the room, then join to subscribe to live countdown and standings updates."}
            </p>
          </div>

          <div className="rounded-full border border-[color:var(--line)] px-3 py-2 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {labelConnectionState(connectionState)}
          </div>
        </div>

        {!room ? (
          <LobbyPreview preview={preview} isPending={isPending} onJoin={join} />
        ) : (
          <LobbyControls
            room={room}
            localPlayer={localPlayer}
            countdownMs={countdownMs}
            isPending={isPending}
            onLeave={leave}
            onToggleReady={toggleReady}
            onStartCountdown={startCountdown}
          />
        )}

        {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </Card>

      <div className="space-y-6">
        <PlayerListCard room={room} preview={preview} localPlayer={localPlayer} />
      </div>
    </section>
  );
}

function LobbyPreview({
  preview,
  isPending,
  onJoin
}: {
  preview: MultiplayerRoomPreview | null;
  isPending: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Host" value={preview?.hostDisplayName ?? "Unknown"} />
        <StatTile label="Players" value={`${preview?.playerCount ?? 0} / ${preview?.maxPlayers ?? "--"}`} />
        <StatTile label="Race length" value={`${preview?.durationMinutes ?? "--"} min`} />
        <StatTile label="Status" value={preview?.status ?? "unknown"} />
      </div>
      <Button onClick={onJoin} disabled={isPending} className="px-6 py-3 text-base">
        {isPending ? "Joining..." : "Join Room"}
      </Button>
    </div>
  );
}

function LobbyControls({
  room,
  localPlayer,
  countdownMs,
  isPending,
  onLeave,
  onToggleReady,
  onStartCountdown
}: {
  room: MultiplayerRoomState;
  localPlayer: MultiplayerPlayerView | null;
  countdownMs: number;
  isPending: boolean;
  onLeave: () => void;
  onToggleReady: (ready: boolean) => void;
  onStartCountdown: () => void;
}) {
  const isHost = Boolean(localPlayer?.isHost);
  const isReady = Boolean(localPlayer?.isReady);
  const canStartCountdown = room.canStart && isHost && room.status === "pending";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Players" value={`${room.players.filter((player) => !player.leftAt).length} / ${room.maxPlayers}`} />
        <StatTile label="Race length" value={`${room.durationMinutes} min`} />
        <StatTile
          label={room.status === "countdown" ? "Race starts in" : "Status"}
          value={room.status === "countdown" ? formatCountdownMs(countdownMs) : room.status}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => onToggleReady(!isReady)} disabled={isPending} className="px-6 py-3 text-base">
          {isReady ? "Unready" : "Ready Up"}
        </Button>
        <Button onClick={onStartCountdown} disabled={!canStartCountdown || isPending} className="px-6 py-3 text-base">
          {room.status === "countdown" ? "Starting..." : "Start Race"}
        </Button>
        <Button onClick={onLeave} disabled={isPending} className="px-6 py-3 text-base">
          Leave Room
        </Button>
      </div>

      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p>
          {isHost
            ? "You’re the host. Once every active player is ready, you can lock the room and start the race."
            : "The host starts the race once everyone in the lobby is ready."}
        </p>
        <p>
          Shared prompt stream locked: {room.isLocked ? "yes" : "not yet"} · Race length: {room.durationMinutes} min
        </p>
      </div>
    </div>
  );
}

function PlayerListCard({
  room,
  preview,
  localPlayer
}: {
  room: MultiplayerRoomState | null;
  preview: MultiplayerRoomPreview | null;
  localPlayer: MultiplayerPlayerView | null;
}) {
  const players = room?.players ?? [];

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Players</p>
        <h2 className="text-xl font-semibold">{room ? "Live lobby roster" : "Room preview"}</h2>
      </div>

      {room ? (
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.playerId}
              className="flex items-center justify-between gap-3 border border-[color:var(--line)] px-3 py-3"
            >
              <div>
                <p className="font-medium">
                  {player.displayName}
                  {player.isHost ? <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Host</span> : null}
                  {player.playerId === localPlayer?.playerId ? <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">You</span> : null}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {player.leftAt ? "Left room" : player.isReady ? "Ready" : "Waiting"}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{player.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Host: {preview?.hostDisplayName ?? "Unknown"} · Players: {preview?.playerCount ?? 0}/{preview?.maxPlayers ?? "--"} · {preview?.durationMinutes ?? "--"} min
        </p>
      )}
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[color:var(--line)] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold capitalize">{value}</p>
    </div>
  );
}

function RoomStatusCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="mx-auto max-w-3xl space-y-3">
      <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Multiplayer</p>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-sm leading-7 text-[var(--muted)]">{body}</p>
    </Card>
  );
}

function labelConnectionState(connectionState: string) {
  if (connectionState === "live") return "Live Sync";
  if (connectionState === "connecting") return "Connecting";
  if (connectionState === "reconnecting") return "Reconnecting";
  if (connectionState === "offline") return "Offline";
  return "Idle";
}

function formatCountdownMs(value: number) {
  const seconds = Math.max(0, Math.ceil(value / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
