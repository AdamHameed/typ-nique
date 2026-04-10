"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GameSessionState } from "@typ-nique/types";
import { createGameSession, finishSession, getGameSession, skipRound, submitGameAnswer } from "../lib/api";
import { useRoundPlay } from "../hooks/use-round-play";
import { RoundPlayShell } from "./round-play-shell";

export function PlayClient({ mode = "practice" }: { mode?: "practice" | "daily" }) {
  const router = useRouter();
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [isPending, startTransition] = useTransition();
  const pollingRef = useRef<number | null>(null);
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null);
  const {
    source,
    status,
    fatalError,
    latestPreview,
    setSource,
    setStatus,
    setFatalError,
    setLatestPreview,
    handleSubmit,
    handleSkip,
    handleClearDraft
  } = useRoundPlay({
    session,
    initialStatus: "Preparing a run...",
    autoSubmitStrategy: "solo",
    onRefreshSession: refreshSession,
    onSubmitRound: async (input) => {
      try {
        const response = await submitGameAnswer(input);

        if (response.data.sessionState) {
          setSession(response.data.sessionState);
        }

        return response.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Submission failed.";

        if (message.includes("not accessible") || message.includes("not found")) {
          clearRoundState();
          await refreshSession(input.sessionId, true);
        }

        throw error;
      }
    },
    onSkipRound: async (input) => {
      try {
        const response = await skipRound(input);
        setSession(response.data);
        return response.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Skip failed.";

        if (message.includes("not accessible") || message.includes("not found")) {
          clearRoundState();
          await refreshSession(input.sessionId, true);
        }

        throw error;
      }
    }
  });

  useEffect(() => {
    void bootstrapSession();

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
  }, [mode]);

  useEffect(() => {
    if (!session) return;

    if (session.status === "completed") {
      window.localStorage.removeItem(getSessionStorageKey(mode));
      router.push(`/results/${session.id}`);
      return;
    }

    if (session.currentRound) {
      setStatus(session.lastResult?.feedback ?? "Type until the preview matches the target.");
    }
  }, [mode, router, session?.currentRound?.roundId, session?.status]);

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
    if (bootstrapPromiseRef.current) {
      await bootstrapPromiseRef.current;
      return;
    }

    bootstrapPromiseRef.current = (async () => {
    const existingId = window.localStorage.getItem(getSessionStorageKey(mode));

    if (existingId) {
      const existing = await getGameSession(existingId).catch(() => null);

      if (existing?.data) {
        setSession(existing.data);
        return;
      }
    }

    const created = await createGameSession(mode);
    window.localStorage.setItem(getSessionStorageKey(mode), created.data.id);
    setSession(created.data);
    })();

    try {
      await bootstrapPromiseRef.current;
    } finally {
      bootstrapPromiseRef.current = null;
    }
  }

  async function refreshSession(sessionId: string, noisy = true) {
    const next = await getGameSession(sessionId).catch(() => null);

    if (!next?.data) {
      if (sessionId === window.localStorage.getItem(getSessionStorageKey(mode))) {
        window.localStorage.removeItem(getSessionStorageKey(mode));
      }

      if (noisy) {
        setStatus("That run was no longer available. Starting a fresh session.");
      }

      await bootstrapSession();
      return;
    }

    setSession(next.data);
    setFatalError(null);

    if (noisy && next.data.lastResult?.feedback) {
      setStatus(next.data.lastResult.feedback);
    }
  }

  function handleFinish() {
    if (!session) return;

    startTransition(async () => {
      try {
        await finishSession(session.id);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Finish request failed. Opening results anyway.");
      } finally {
        window.localStorage.removeItem(getSessionStorageKey(mode));
        router.push(`/results/${session.id}`);
      }
    });
  }

  return (
    <RoundPlayShell
      session={session}
      source={source}
      status={status}
      fatalError={fatalError}
      latestPreview={latestPreview}
      onSourceChange={setSource}
      onSubmit={handleSubmit}
      onSkip={handleSkip}
      onFinish={handleFinish}
      onClearDraft={handleClearDraft}
      onPreviewResult={setLatestPreview}
      isSubmitting={isPending}
    />
  );

  function clearRoundState() {
    if (session?.currentRound) {
      window.localStorage.removeItem(`typ-nique:draft:${session.id}:${session.currentRound.roundId}`);
    }
  }
}

function getSessionStorageKey(mode: "practice" | "daily") {
  return `typ-nique:session-id:${mode}`;
}
