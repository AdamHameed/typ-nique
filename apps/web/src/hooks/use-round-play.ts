"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { GameSessionState, PreviewRenderResponse, SubmissionOutcome } from "@typ-nique/types";

export interface RoundSubmitInput {
  sessionId: string;
  roundId: string;
  source: string;
}

export interface RoundSkipInput {
  sessionId: string;
  roundId: string;
}

export interface UseRoundPlayOptions {
  session: GameSessionState | null;
  initialStatus: string;
  autoSubmitStrategy: "solo" | "multiplayer";
  onSubmitRound: (input: RoundSubmitInput) => Promise<SubmissionOutcome>;
  onSkipRound: (input: RoundSkipInput) => Promise<GameSessionState>;
  onRefreshSession?: (sessionId: string, noisy?: boolean) => Promise<void>;
}

export interface UseRoundPlayResult {
  source: string;
  status: string;
  fatalError: string | null;
  latestPreview: PreviewRenderResponse | null;
  isPending: boolean;
  setSource: (value: string) => void;
  setStatus: (value: string) => void;
  setFatalError: (value: string | null) => void;
  setLatestPreview: (value: PreviewRenderResponse | null) => void;
  handleSubmit: () => void;
  handleSkip: () => void;
  handleClearDraft: () => void;
}

export function useRoundPlay({
  session,
  initialStatus,
  autoSubmitStrategy,
  onSubmitRound,
  onSkipRound,
  onRefreshSession
}: UseRoundPlayOptions): UseRoundPlayResult {
  const [source, setSource] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [latestPreview, setLatestPreview] = useState<PreviewRenderResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoSubmitKeyRef = useRef<string | null>(null);
  const skipLockRef = useRef<string | null>(null);

  useEffect(() => {
    if (session?.currentRound) {
      setStatus(session.lastResult?.feedback ?? initialStatus);
    }
  }, [initialStatus, session?.currentRound?.roundId, session?.lastResult?.feedback]);

  useEffect(() => {
    if (!session?.currentRound) {
      return;
    }

    const savedDraft = window.localStorage.getItem(getDraftStorageKey(session.id, session.currentRound.roundId));
    setSource(savedDraft ?? "");
    setLatestPreview(null);
    autoSubmitKeyRef.current = null;
    skipLockRef.current = null;
  }, [session?.id, session?.currentRound?.roundId]);

  useEffect(() => {
    if (!session?.currentRound) {
      return;
    }

    const storageKey = getDraftStorageKey(session.id, session.currentRound.roundId);

    if (!source.trim()) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, source);
  }, [session?.id, session?.currentRound?.roundId, source]);

  useEffect(() => {
    const currentRound = session?.currentRound;

    if (!currentRound || !latestPreview?.ok || isPending) {
      return;
    }

    const trimmedSource = source.trim();

    if (!trimmedSource) {
      return;
    }

    const matched = autoSubmitStrategy === "solo"
      ? (
          (Boolean(currentRound.challenge.renderHash) &&
            Boolean(latestPreview.renderHash) &&
            latestPreview.renderHash === currentRound.challenge.renderHash) ||
          latestPreview.matchesTarget === true
        )
      : latestPreview.matchesTarget === true;

    if (!matched) {
      return;
    }

    const autoSubmitKey = `${session.id}:${currentRound.roundId}:${trimmedSource}:${latestPreview.matchTier ?? latestPreview.renderHash ?? "match"}`;

    if (autoSubmitKeyRef.current === autoSubmitKey) {
      return;
    }

    autoSubmitKeyRef.current = autoSubmitKey;
    handleSubmit();
  }, [
    autoSubmitStrategy,
    isPending,
    latestPreview,
    session?.currentRound,
    session?.id,
    source
  ]);

  function handleSubmit() {
    if (!session?.currentRound || !source.trim()) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await onSubmitRound({
          sessionId: session.id,
          roundId: session.currentRound!.roundId,
          source
        });

        if (response.verdict === "correct" && !response.queuedRenderCheck) {
          clearDraft(session.id, session.currentRound!.roundId);
        } else {
          setStatus(response.feedback);
        }

        if (response.queuedRenderCheck) {
          setStatus("Rendered output check running...");
          await onRefreshSession?.(session.id, true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Submission failed.";
        setStatus(message);
      }
    });
  }

  function handleSkip() {
    if (!session?.currentRound) {
      return;
    }

    const skipKey = `${session.id}:${session.currentRound.roundId}`;

    if (skipLockRef.current === skipKey || isPending) {
      return;
    }

    skipLockRef.current = skipKey;
    setStatus("Skipping prompt...");

    startTransition(async () => {
      try {
        await onSkipRound({
          sessionId: session.id,
          roundId: session.currentRound!.roundId
        });

        clearDraft(session.id, session.currentRound!.roundId);
        setStatus("Skipped. Moving to the next challenge.");
      } catch (error) {
        skipLockRef.current = null;
        const message = error instanceof Error ? error.message : "Skip failed.";
        setStatus(message);
      }
    });
  }

  function handleClearDraft() {
    setSource("");

    if (session?.currentRound) {
      clearDraft(session.id, session.currentRound.roundId);
    }
  }

  return {
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
  };
}

export function getDraftStorageKey(sessionId: string, roundId: string) {
  return `typ-nique:draft:${sessionId}:${roundId}`;
}

export function clearDraft(sessionId: string, roundId: string) {
  window.localStorage.removeItem(getDraftStorageKey(sessionId, roundId));
}
