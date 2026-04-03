"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GameSessionState } from "@typ-nique/types";
import { Card } from "@typ-nique/ui";
import { createPracticeSession, finishSession, getGameSession, skipRound, submitGameAnswer } from "../lib/api";

const STORAGE_KEY = "typ-nique:session-id";

export function PlayClient() {
  const router = useRouter();
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("Starting a fresh run...");
  const [isPending, startTransition] = useTransition();
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    void bootstrapSession();

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    setSource("");

    if (session.status === "completed") {
      window.localStorage.removeItem(STORAGE_KEY);
      router.push(`/results/${session.id}`);
      return;
    }

    if (session.currentRound) {
      setStatus("Type the Typst source and submit when ready.");
    }
  }, [router, session?.currentRound?.roundId, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "active") {
      return;
    }

    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
    }

    pollingRef.current = window.setInterval(() => {
      void refreshSession(session.id, false);
    }, 1500);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
  }, [session?.id, session?.status]);

  async function bootstrapSession() {
    const existingId = window.localStorage.getItem(STORAGE_KEY);

    if (existingId) {
      const existing = await getGameSession(existingId).catch(() => null);

      if (existing?.data) {
        setSession(existing.data);
        return;
      }
    }

    const created = await createPracticeSession();
    window.localStorage.setItem(STORAGE_KEY, created.data.id);
    setSession(created.data);
  }

  async function refreshSession(sessionId: string, noisy = true) {
    const next = await getGameSession(sessionId).catch(() => null);

    if (!next?.data) {
      return;
    }

    setSession(next.data);

    if (noisy && next.data.lastResult?.feedback) {
      setStatus(next.data.lastResult.feedback);
    }
  }

  function handleSubmit() {
    if (!session?.currentRound || !source.trim()) {
      return;
    }

    setStatus("Checking answer...");

    startTransition(async () => {
      const response = await submitGameAnswer({
        sessionId: session.id,
        roundId: session.currentRound!.roundId,
        source
      });

      if (response.data.sessionState) {
        setSession(response.data.sessionState);
      }

      setStatus(response.data.feedback);

      if (response.data.queuedRenderCheck) {
        setStatus("Render comparison running...");
        await refreshSession(session.id, true);
      }
    });
  }

  function handleSkip() {
    if (!session?.currentRound) {
      return;
    }

    setStatus("Skipping round...");

    startTransition(async () => {
      const response = await skipRound({
        sessionId: session.id,
        roundId: session.currentRound!.roundId
      });

      setSession(response.data);
      setStatus("Round skipped. Next challenge loaded.");
    });
  }

  function handleFinish() {
    if (!session) {
      return;
    }

    startTransition(async () => {
      await finishSession(session.id);
      window.localStorage.removeItem(STORAGE_KEY);
      router.push(`/results/${session.id}`);
    });
  }

  const current = session?.currentRound;
  const remaining = formatDuration(session?.timeRemainingMs ?? 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Challenge</p>
            <p className="mt-1 text-xl font-semibold">{current?.challenge.title ?? "Loading..."}</p>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">{remaining}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Rendered target</span>
            <span>Difficulty: {current?.challenge.difficulty ?? "easy"}</span>
          </div>
          <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-white p-6 text-slate-950">
            {current ? (
              <div className="overflow-auto rounded-xl" dangerouslySetInnerHTML={{ __html: current.challenge.renderedSvg }} />
            ) : (
              <p>Preparing challenge...</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 text-sm">
          <StatCard label="Score" value={String(session?.score ?? 0)} />
          <StatCard label="Solved" value={String(session?.solvedCount ?? 0)} />
          <StatCard label="Accuracy" value={`${Math.round((session?.accuracy ?? 0) * 100)}%`} />
          <StatCard label="Round" value={String(current?.roundNumber ?? 0)} />
        </div>
      </Card>
      <Card className="space-y-4">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Typst source input</span>
          <span>Ctrl + Enter to submit</span>
        </div>
        <textarea
          className="min-h-[360px] w-full rounded-3xl border border-white/10 bg-slate-950/80 p-5 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-500"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type the Typst source that reproduces the target..."
          disabled={!current || isPending}
        />
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{status}</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!current || !source.trim() || isPending}
              className="rounded-full bg-cyan-400 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50"
            >
              Submit
            </button>
            <button
              onClick={handleSkip}
              disabled={!current || isPending}
              className="rounded-full border border-white/15 px-5 py-2 font-semibold text-white"
            >
              Skip
            </button>
          </div>
          <button onClick={handleFinish} disabled={!session || isPending} className="text-sm text-slate-400 underline-offset-4 hover:underline">
            End run
          </button>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
