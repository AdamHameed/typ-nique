"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GameSessionState } from "@typ-nique/types";
import { Button, Card } from "@typ-nique/ui";
import { LiveRenderPreview } from "./live-render-preview";
import { TypstEditor } from "./typst-editor";
import { createPracticeSession, finishSession, getGameSession, skipRound, submitGameAnswer } from "../lib/api";
import { optimizeTypstSvgForSnippet } from "../lib/typst-snippet";

const SESSION_STORAGE_KEY = "typ-nique:session-id";

export function PlayClient() {
  const router = useRouter();
  const [session, setSession] = useState<GameSessionState | null>(null);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("Preparing a run...");
  const [fatalError, setFatalError] = useState<string | null>(null);
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

    if (session.status === "completed") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      router.push(`/results/${session.id}`);
      return;
    }

    if (session.currentRound) {
      setStatus(session.lastResult?.feedback ?? "Type the Typst source and submit when ready.");
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
    const existingId = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (existingId) {
      const existing = await getGameSession(existingId).catch(() => null);

      if (existing?.data) {
        setSession(existing.data);
        return;
      }
    }

    const created = await createPracticeSession();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created.data.id);
    setSession(created.data);
  }

  async function refreshSession(sessionId: string, noisy = true) {
    const next = await getGameSession(sessionId).catch(() => null);

    if (!next?.data) {
      if (noisy) {
        setFatalError("The session could not be refreshed.");
      }
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

    setStatus("Running validation pipeline...");

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

        setStatus(response.data.feedback);

        if (response.data.verdict === "correct" && !response.data.queuedRenderCheck) {
          clearDraft(session.id, session.currentRound!.roundId);
        }

        if (response.data.queuedRenderCheck) {
          setStatus("Rendered output check running...");
          await refreshSession(session.id, true);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Submission failed.");
      }
    });
  }

  function handleSkip() {
    if (!session?.currentRound) {
      return;
    }

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
        setStatus(error instanceof Error ? error.message : "Skip failed.");
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
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        router.push(`/results/${session.id}`);
      }
    });
  }

  useEffect(() => {
    if (!session?.currentRound) {
      return;
    }

    const savedDraft = window.localStorage.getItem(getDraftStorageKey(session.id, session.currentRound.roundId));
    setSource(savedDraft ?? "");
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

  const current = session?.currentRound;
  const optimizedTargetSvg = current?.challenge.renderedSvg
    ? optimizeTypstSvgForSnippet(current.challenge.renderedSvg)
    : null;
  const timerLabel = formatDuration(session?.timeRemainingMs ?? 0);
  const normalizedStatus = status.trim().toLowerCase();
  const feedbackTone = normalizedStatus.startsWith("accepted")
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
    : normalizedStatus.includes("render") || normalizedStatus.includes("checking")
      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
      : normalizedStatus.includes("error") ||
          normalizedStatus.includes("incorrect") ||
          normalizedStatus.includes("did not match") ||
          normalizedStatus.includes("unavailable") ||
          normalizedStatus.includes("compile")
        ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
        : "border-[color:var(--line)] bg-[var(--panel-strong)] text-[var(--muted)]";

  return (
    <div className="space-y-2.5">
      {fatalError ? (
        <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm leading-6 text-rose-100">
          {fatalError}
        </div>
      ) : null}
      <Card className="p-2">
        <div className="grid gap-2 sm:grid-cols-4">
          <TopBarStat label="Timer" value={timerLabel} accent />
          <TopBarStat label="Score" value={String(session?.score ?? 0)} />
          <TopBarStat label="Streak" value={String(session?.streak ?? 0)} />
          <TopBarStat label="Accuracy" value={`${Math.round((session?.accuracy ?? 0) * 100)}%`} />
        </div>
      </Card>

      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="grid items-stretch gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Card className="flex h-full min-h-[68px] flex-col space-y-1 p-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Live Preview</p>
              <LiveRenderPreview
                source={source}
                inputMode={current?.challenge.inputMode ?? "math"}
                enabled={Boolean(current) && !isPending}
              />
            </Card>
          </div>

          <div className="space-y-2">
            <Card className="flex h-full min-h-[68px] flex-col space-y-1 p-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Target</p>
                  <h2 className="mt-0.5 text-[13px] font-semibold text-[var(--text)]">{current?.challenge.title ?? "Loading challenge"}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-[color:var(--line)] bg-[var(--panel-strong)] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    {current?.challenge.difficulty ?? "easy"}
                  </div>
                  <div className="rounded-full border border-[color:var(--line)] bg-[var(--panel-strong)] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    Round {String(current?.roundNumber ?? 0)}
                  </div>
                </div>
              </div>
              <div className="typst-snippet-frame flex-1">
                {current && optimizedTargetSvg ? (
                  <div
                    className="typst-snippet"
                    dangerouslySetInnerHTML={{ __html: optimizedTargetSvg }}
                  />
                ) : (
                  <div className="flex h-full min-h-[30px] items-center justify-center text-[var(--muted)]">Loading render...</div>
                )}
              </div>
              <div className="min-h-[4px]" />
            </Card>
          </div>
        </div>

        <Card className="mx-auto w-full max-w-5xl space-y-2.5 p-2.5">
          <TypstEditor
            value={source}
            onChange={setSource}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            inputMode={current?.challenge.inputMode ?? "math"}
            disabled={!current || isPending}
            isSubmitting={isPending}
          />
          <div className={`rounded-[16px] border px-3 py-2 text-sm leading-6 ${feedbackTone}`}>{status}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSubmit} disabled={!current || !source.trim() || isPending} className="px-4 py-2 text-sm">
              Submit
            </Button>
            <button
              onClick={handleSkip}
              disabled={!current || isPending}
              className="rounded-full border border-[color:var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--panel)] disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={() => {
                setSource("");

                if (session?.currentRound) {
                  clearDraft(session.id, session.currentRound.roundId);
                }
              }}
              disabled={isPending}
              className="rounded-full border border-[color:var(--line)] px-3.5 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--panel-strong)] disabled:opacity-50"
            >
              Clear Draft
            </button>
            <button
              onClick={handleFinish}
              disabled={!session || isPending}
              className="ml-auto text-sm text-[var(--muted)] underline-offset-4 transition hover:text-[var(--text)] hover:underline"
            >
              End run
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function getDraftStorageKey(sessionId: string, roundId: string) {
  return `typ-nique:draft:${sessionId}:${roundId}`;
}

function clearDraft(sessionId: string, roundId: string) {
  window.localStorage.removeItem(getDraftStorageKey(sessionId, roundId));
}

function TopBarStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-[14px] border px-2.5 py-2 ${
        accent
          ? "border-[color:var(--line-strong)] bg-[var(--panel)] text-[var(--text)]"
          : "border-[color:var(--line)] bg-[var(--panel-strong)] text-[var(--text)]"
      }`}
    >
      <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
    </div>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
