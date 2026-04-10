"use client";

import type { ReactNode } from "react";
import type { GameSessionState, PreviewRenderResponse } from "@typ-nique/types";
import { LiveRenderPreview } from "./live-render-preview";
import { TypstSnippet } from "./typst-snippet";
import { TypstEditor } from "./typst-editor";
import { optimizeTypstSvgForSnippet } from "../lib/typst-snippet";

interface RoundPlayShellProps {
  session: GameSessionState | null;
  source: string;
  status: string;
  fatalError?: string | null;
  latestPreview: PreviewRenderResponse | null;
  title?: string;
  subtitle?: string;
  finishLabel?: string;
  onSourceChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onClearDraft: () => void;
  onPreviewResult: (result: PreviewRenderResponse | null) => void;
  isSubmitting?: boolean;
  showSkip?: boolean;
  topActions?: ReactNode;
  topMetrics?: ReactNode;
  beforeEditor?: ReactNode;
  afterEditor?: ReactNode;
}

export function RoundPlayShell({
  session,
  source,
  status,
  fatalError = null,
  latestPreview,
  title = "Typ-Nique",
  subtitle = "A Typst Typesetting Game",
  finishLabel = "End Game",
  onSourceChange,
  onSubmit,
  onSkip,
  onFinish,
  onClearDraft,
  onPreviewResult,
  isSubmitting = false,
  showSkip = true,
  topActions,
  topMetrics,
  beforeEditor,
  afterEditor
}: RoundPlayShellProps) {
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
        <p className="texnique-title">{title}</p>
        <p className="texnique-subtitle">{subtitle}</p>

        <div className="texnique-top-row">
          <div className="texnique-button-row">
            {showSkip ? (
              <button
                onClick={onSkip}
                disabled={!current || isSubmitting}
                className="texnique-button"
              >
                Skip This Problem
              </button>
            ) : null}
            <button
              onClick={onFinish}
              disabled={!session || isSubmitting}
              className="texnique-button"
            >
              {finishLabel}
            </button>
            {topActions}
          </div>

          <div className="texnique-top-stats">
            {topMetrics}
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
              ? `${current.challenge.difficulty ?? "easy"} · Round ${String(current.roundNumber)} · Worth ${current.pointsAvailable} pts · x${formatMultiplier(current.streakMultiplier)}`
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
          enabled={Boolean(current) && !isSubmitting}
          onPreviewResult={onPreviewResult}
          shadowSvg={optimizedTargetSvg}
        />

        {beforeEditor}

        <TypstEditor
          value={source}
          onChange={onSourceChange}
          onSubmit={onSubmit}
          onSkip={onSkip}
          inputMode={current?.challenge.inputMode ?? "math"}
          disabled={!current || isSubmitting}
          isSubmitting={isSubmitting}
          autoFocusKey={current ? `${session?.id ?? "session"}:${current.roundId}` : "inactive"}
        />

        {afterEditor}

        <div className="texnique-bottom-row">
          <div className={statusClass}>{fatalError ?? status}</div>
          <button
            onClick={onClearDraft}
            disabled={isSubmitting}
            className="texnique-button texnique-button--small"
          >
            Clear Draft
          </button>
        </div>

        {latestPreview && !latestPreview.ok && latestPreview.message ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{latestPreview.message}</p>
        ) : null}
      </div>
    </main>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMultiplier(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}
