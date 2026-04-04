"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeInputMode, PreviewRenderResponse } from "@typ-nique/types";
import { previewTypstRender } from "../lib/api";

interface LiveRenderPreviewProps {
  source: string;
  inputMode: ChallengeInputMode;
  enabled?: boolean;
}

type PreviewState =
  | {
      status: "idle";
      data: null;
      message: string;
    }
  | {
      status: "loading";
      data: PreviewRenderResponse | null;
      message: string;
    }
  | {
      status: "success";
      data: PreviewRenderResponse;
      message: string;
    }
  | {
      status: "error";
      data: PreviewRenderResponse | null;
      message: string;
    };

const PREVIEW_DEBOUNCE_MS = 700;

export function LiveRenderPreview({ source, inputMode, enabled = true }: LiveRenderPreviewProps) {
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    data: null,
    message: "Preview updates after a short pause so typing stays fast."
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      setState({
        status: "idle",
        data: null,
        message: "Preview is paused until a challenge is active."
      });
      return;
    }

    const trimmed = source.trim();

    if (!trimmed) {
      abortRef.current?.abort();
      setState({
        status: "idle",
        data: null,
        message: "Your draft render will appear here once you start typing."
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      setState((current) => ({
        status: "loading",
        data: current.data,
        message: "Rendering preview..."
      }));

      void previewTypstRender(trimmed, inputMode, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }

          if (!response.ok) {
            setState({
              status: "error",
              data: response,
              message: response.message ?? "Typst could not render this draft yet."
            });
            return;
          }

          setState({
            status: "success",
            data: response,
            message: response.autoWrappedMath
              ? "Preview is up to date. Bare math input was wrapped automatically for game-mode rendering."
              : response.cached
                ? "Showing a cached preview."
                : "Preview is up to date."
          });
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          setState({
            status: "error",
            data: null,
            message: error instanceof Error ? error.message : "Preview service is unavailable right now."
          });
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled, inputMode, source]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Live Preview</p>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Debounced render</p>
      </div>

      <div className="min-h-[200px] rounded-[24px] border border-white/8 bg-slate-950/70 p-4">
        {state.status === "success" && state.data?.svg ? (
          <div className="overflow-auto rounded-2xl bg-white p-4 shadow-inner" dangerouslySetInnerHTML={{ __html: state.data.svg }} />
        ) : (
          <div className="flex min-h-[168px] items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center text-sm leading-6 text-slate-400">
            {state.message}
          </div>
        )}
      </div>

      <div
        className={`rounded-[22px] border px-4 py-3 text-sm leading-6 ${
          state.status === "error"
            ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
            : state.status === "loading"
              ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
              : "border-white/8 bg-white/5 text-slate-300"
        }`}
      >
        {state.message}
        {state.data?.durationMs ? ` (${state.data.durationMs} ms)` : ""}
      </div>

      {inputMode === "math" && state.data?.autoWrappedMath && state.data.effectiveSource ? (
        <div className="rounded-[22px] border border-cyan-300/12 bg-cyan-300/8 px-4 py-3 text-xs leading-6 text-cyan-100">
          Rendering this draft as <span className="font-[var(--font-mono)]">{state.data.effectiveSource}</span>
        </div>
      ) : null}
    </div>
  );
}
