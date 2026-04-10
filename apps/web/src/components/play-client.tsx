"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GameSessionState, PreviewRenderResponse } from "@typ-nique/types";
import { LiveRenderPreview } from "./live-render-preview";
import { TypstSnippet } from "./typst-snippet";
import { TypstEditor } from "./typst-editor";
import { createGameSession, finishSession, getGameSession, skipRound, submitGameAnswer } from "../lib/api";
import { optimizeTypstSvgForSnippet } from "../lib/typst-snippet";

export function PlayClient({ mode = "practice" }: { mode?: "practice" | "daily" }) {
  const router = useRouter();
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("Preparing a run...");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [latestPreview, setLatestPreview] = useState<PreviewRenderResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const pollingRef = useRef<number | null>(null);
  const autoSubmitKeyRef = useRef<string | null>(null);
  const skipLockRef = useRef<string | null>(null);
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null);

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

  function handleSubmit() {
    if (!session?.currentRound || !source.trim()) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await submitGameAnswer({
          sessionId: session.id,
          roundId: session.currentRound!.roundId,
          source
        });

        if (response.data.sessionState) {
          setSession(response.data.sessionState);
        }

        if (response.data.verdict === "correct" && !response.data.queuedRenderCheck) {
          clearDraft(session.id, session.currentRound!.roundId);
        } else {
          setStatus(response.data.feedback);
        }

        if (response.data.queuedRenderCheck) {
          setStatus("Rendered output check running...");
          await refreshSession(session.id, true);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Submission failed.";

        if (message.includes("not accessible") || message.includes("not found")) {
          clearDraft(session.id, session.currentRound!.roundId);
          await refreshSession(session.id, true);
          return;
        }

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
        const response = await skipRound({
          sessionId: session.id,
          roundId: session.currentRound!.roundId
        });

        clearDraft(session.id, session.currentRound!.roundId);
        setSession(response.data);
        setStatus("Skipped. Moving to the next challenge.");
      } catch (error) {
        skipLockRef.current = null;
        const message = error instanceof Error ? error.message : "Skip failed.";

        if (message.includes("not accessible") || message.includes("not found")) {
          clearDraft(session.id, session.currentRound!.roundId);
          await refreshSession(session.id, true);
          return;
        }

        setStatus(message);
      }
    });
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

  function handleClearDraft() {
    setSource("");

    if (session?.currentRound) {
      clearDraft(session.id, session.currentRound.roundId);
    }
  }

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

    const hashMatches =
      Boolean(currentRound.challenge.renderHash) &&
      Boolean(latestPreview.renderHash) &&
      latestPreview.renderHash === currentRound.challenge.renderHash;
    const serverMatched = latestPreview.matchesTarget === true;

    if (!hashMatches && !serverMatched) {
      return;
    }

    const autoSubmitKey = `${session.id}:${currentRound.roundId}:${trimmedSource}:${latestPreview.matchTier ?? latestPreview.renderHash ?? "match"}`;

    if (autoSubmitKeyRef.current === autoSubmitKey) {
      return;
    }

    autoSubmitKeyRef.current = autoSubmitKey;
    handleSubmit();
  }, [isPending, latestPreview, session?.currentRound, session?.id, source]);

  const current = session?.currentRound;
  const optimizedTargetSvg = current?.challenge.renderedSvg
    ? optimizeTypstSvgForSnippet(current.challenge.renderedSvg)
    : null;
  const timerLabel = formatDuration(session?.timeRemainingMs ?? 0);
  const normalizedStatus = status.trim().toLowerCase();
  const statusClass = fatalError
    ? "texnique-status texnique-status--error"
    : normalizedStatus.startsWith("accepted")
      ? "texnique-status texnique-status--success"
      : normalizedStatus.includes("error") ||
          normalizedStatus.includes("incorrect") ||
          normalizedStatus.includes("did not match") ||
          normalizedStatus.includes("unavailable") ||
          normalizedStatus.includes("compile")
        ? "texnique-status texnique-status--error"
        : normalizedStatus.includes("render") || normalizedStatus.includes("checking")
          ? "texnique-status texnique-status--pending"
          : "texnique-status";

  return (
    <main className="texnique-page">
      <div className="texnique-container">
        <p className="texnique-title">Typ-Nique</p>
        <p className="texnique-subtitle">A Typst Typesetting Game</p>

        <div className="texnique-top-row">
          <div className="texnique-button-row">
            <button
              onClick={handleSkip}
              disabled={!current || isPending}
              className="texnique-button"
            >
              Skip This Problem
            </button>
            <button
              onClick={handleFinish}
              disabled={!session || isPending}
              className="texnique-button"
            >
              End Game
            </button>
          </div>

          <div className="texnique-top-stats">
            <p className="texnique-metric">
              <b>Score:</b> <span>{session?.score ?? 0}</span>
            </p>
            <p className="texnique-metric">
              <b>Streak:</b> <span>{session?.streak ?? 0}</span>
            </p>
            <p className="texnique-metric">
              <b>Time:</b> <span>{timerLabel}</span>
            </p>
          </div>
        </div>

        <p className="texnique-problem-header">
          <span className="texnique-problem-title">{current?.challenge.title ?? "Loading challenge"}</span>
          <span className="texnique-problem-meta">
            {current
              ? `${current.challenge.difficulty ?? "easy"} · Round ${String(current.roundNumber)}`
              : ""}
          </span>
        </p>

        <p className="texnique-copy">Try to create the following render:</p>

        <div className="texnique-math-display texnique-target-display">
          {current && optimizedTargetSvg ? (
            <TypstSnippet svg={optimizedTargetSvg} />
          ) : (
            <div className="texnique-preview-placeholder">Loading render...</div>
          )}
        </div>

        <p className="texnique-copy">This is what your output looks like:</p>

        <LiveRenderPreview
          source={source}
          inputMode={current?.challenge.inputMode ?? "math"}
          sessionId={session?.id}
          roundId={current?.roundId}
          enabled={Boolean(current) && !isPending}
          onPreviewResult={setLatestPreview}
          shadowSvg={optimizedTargetSvg}
        />

        <TypstEditor
          value={source}
          onChange={setSource}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          inputMode={current?.challenge.inputMode ?? "math"}
          disabled={!current || isPending}
          isSubmitting={isPending}
          autoFocusKey={current ? `${session?.id ?? "session"}:${current.roundId}` : "inactive"}
        />

        <div className="texnique-bottom-row">
          <div className={statusClass}>{fatalError ?? status}</div>
          <button
            onClick={handleClearDraft}
            disabled={isPending}
            className="texnique-button texnique-button--small"
          >
            Clear Draft
          </button>
        </div>
      </div>
    </main>
  );
}

function getDraftStorageKey(sessionId: string, roundId: string) {
  return `typ-nique:draft:${sessionId}:${roundId}`;
}

function getSessionStorageKey(mode: "practice" | "daily") {
  return `typ-nique:session-id:${mode}`;
}

function clearDraft(sessionId: string, roundId: string) {
  window.localStorage.removeItem(getDraftStorageKey(sessionId, roundId));
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
