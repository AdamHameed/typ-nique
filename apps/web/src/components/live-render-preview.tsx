"use client";

import { useEffect, useRef, useState } from "react";
import type { ChallengeInputMode, PreviewRenderResponse } from "@typ-nique/types";
import { previewTypstRender } from "../lib/api";
import { optimizeTypstSvgForSnippet } from "../lib/typst-snippet";

interface LiveRenderPreviewProps {
  source: string;
  inputMode: ChallengeInputMode;
  enabled?: boolean;
  onPreviewResult?: (result: PreviewRenderResponse | null) => void;
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

export function LiveRenderPreview({ source, inputMode, enabled = true, onPreviewResult }: LiveRenderPreviewProps) {
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    data: null,
    message: "Your draft render will appear here once you start typing."
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      onPreviewResult?.(null);
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
      onPreviewResult?.(null);
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
            onPreviewResult?.(response);
            setState({
              status: "error",
              data: response,
              message: response.message ?? "Typst could not render this draft yet."
            });
            return;
          }

          onPreviewResult?.(response);
          setState({
            status: "success",
            data: response,
            message: ""
          });
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          onPreviewResult?.(null);
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
  }, [enabled, inputMode, onPreviewResult, source]);

  const optimizedPreviewSvg =
    state.status === "success" && state.data?.svg ? optimizeTypstSvgForSnippet(state.data.svg) : null;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="typst-snippet-frame">
        {optimizedPreviewSvg ? (
          <div
            className="typst-snippet"
            dangerouslySetInnerHTML={{ __html: optimizedPreviewSvg }}
          />
        ) : (
          <div className="flex min-h-[96px] items-center justify-center rounded-[12px] border border-dashed border-[color:var(--line)] px-4 text-center text-sm leading-6 text-[var(--muted)]">
            {state.message}
          </div>
        )}
      </div>

      {state.status === "error" ? (
        <div className="rounded-[14px] border border-[color:var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs leading-5 text-[var(--text)]">
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
