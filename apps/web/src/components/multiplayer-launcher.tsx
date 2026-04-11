"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@typ-nique/ui";
import { createMultiplayerRoom } from "../lib/api";

export function MultiplayerLauncher() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreateRoom() {
    startTransition(async () => {
      setError(null);

      try {
        const response = await createMultiplayerRoom({
          durationMinutes: Number(durationMinutes)
        });

        window.localStorage.setItem("typ-nique:last-multiplayer-room", response.data.roomCode);
        router.push(`/multiplayer/rooms/${response.data.roomCode}`);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create room.");
      }
    });
  }

  function handleJoinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!roomCode.trim()) {
      setError("Enter a room code to join.");
      return;
    }

    router.push(`/multiplayer/rooms/${roomCode.trim().toUpperCase()}`);
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="space-y-5 border-2 border-[color:var(--text)]">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Live Race Mode</p>
          <h1 className="text-3xl font-semibold">Build a room, lock the prompt order, and race in real time.</h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">
            Everyone gets the same prompt order. The server owns the 5-second start sync, round order, standings, and final placements.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Race length</span>
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              className="w-full border-2 border-[color:var(--text)] bg-[var(--render-surface)] px-3 py-3"
            >
              {[1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value} minute{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 text-sm">
            <span className="font-medium">Room size</span>
            <div className="border-2 border-[color:var(--text)] bg-[var(--render-surface)] px-3 py-3">
              Up to 8 players
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleCreateRoom} disabled={isPending} className="px-6 py-3 text-base">
            {isPending ? "Creating room..." : "Create Room"}
          </Button>
          <p className="self-center text-sm text-[var(--muted)]">The host can start once everyone in the lobby is ready. Race sync is always 5 seconds.</p>
        </div>

        {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </Card>

      <Card className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Join By Code</p>
          <h2 className="text-2xl font-semibold">Reconnect-friendly room entry.</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">
            Enter a room code to load the lobby, sync countdown state, and subscribe to live standings.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleJoinRoom}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Room code</span>
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              className="w-full border-2 border-[color:var(--text)] bg-[var(--render-surface)] px-4 py-3 font-[var(--font-mono)] text-lg uppercase tracking-[0.25em]"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <Button type="submit" className="w-full justify-center px-6 py-3 text-base">
            Open Room
          </Button>
        </form>
      </Card>
    </section>
  );
}
