"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeInputMode, PreviewRenderResponse } from "@typ-nique/types";
import { previewTypstRender } from "../lib/api";
import { optimizeTypstSvgForSnippet } from "../lib/typst-snippet";
import { TypstSnippet } from "./typst-snippet";

interface LiveRenderPreviewProps {
  source: string;
  inputMode: ChallengeInputMode;
  sessionId?: string;
  roundId?: string;
  enabled?: boolean;
  onPreviewResult?: (result: PreviewRenderResponse | null) => void;
  shadowSvg?: string | null;
}

type PreviewState =
  | {
      status: "idle";
      data: null;
      errorMessage: null;
    }
  | {
      status: "loading";
      data: PreviewRenderResponse | null;
      errorMessage: null;
    }
  | {
      status: "success";
      data: PreviewRenderResponse;
      errorMessage: null;
    }
  | {
      status: "error";
      data: PreviewRenderResponse | null;
      errorMessage: string;
    };

const PREVIEW_DEBOUNCE_MS = 700;

export function LiveRenderPreview({
  source,
  inputMode,
  sessionId,
  roundId,
  enabled = true,
  onPreviewResult,
  shadowSvg
}: LiveRenderPreviewProps) {
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    data: null,
    errorMessage: null
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      onPreviewResult?.(null);
      setState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    const trimmed = source.trim();

    if (!trimmed) {
      abortRef.current?.abort();
      onPreviewResult?.(null);
      setState({
        status: "idle",
        data: null,
        errorMessage: null
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      setState((current) => ({
        status: "loading",
        data: current.data?.ok ? current.data : null,
        errorMessage: null
      }));

      void previewTypstRender(trimmed, inputMode, controller.signal, { sessionId, roundId })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }

          if (!response.ok) {
            onPreviewResult?.(response);
            setState((current) => ({
              status: "error",
              data: current.data?.ok ? current.data : null,
              errorMessage: response.message ?? "Render failed."
            }));
            return;
          }

          onPreviewResult?.(response);
          setState({
            status: "success",
            data: response,
            errorMessage: null
          });
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }

          onPreviewResult?.(null);
          setState((current) => ({
            status: "error",
            data: current.data?.ok ? current.data : null,
            errorMessage: "Render failed."
          }));
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled, inputMode, onPreviewResult, roundId, sessionId, source]);

  const optimizedPreviewSvg = state.data?.ok && state.data.svg ? optimizeTypstSvgForSnippet(state.data.svg) : null;
  const liveRegionMessage =
    state.status === "loading"
      ? "Rendering preview."
      : state.status === "error"
        ? state.errorMessage
        : optimizedPreviewSvg
          ? "Preview updated."
          : "";

  return (
    <div className="space-y-2">
      <div className="texnique-math-display texnique-preview-display">
        {shadowSvg ? (
          <TypstSnippet svg={shadowSvg} className="texnique-preview-shadow" ariaHidden />
        ) : null}

        {optimizedPreviewSvg ? (
          <TypstSnippet svg={optimizedPreviewSvg} className="texnique-preview-output" />
        ) : null}
      </div>

      {state.status === "error" ? (
        <div className="texnique-status texnique-status--error">
          {state.errorMessage}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {liveRegionMessage}
      </p>
    </div>
  );
}
