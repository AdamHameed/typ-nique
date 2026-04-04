"use client";

import { useId } from "react";
import type { ChallengeInputMode } from "@typ-nique/types";

interface TypstEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSkip: () => void;
  inputMode: ChallengeInputMode;
  disabled?: boolean;
  isSubmitting?: boolean;
}

export function TypstEditor({
  value,
  onChange,
  onSkip,
  inputMode,
  disabled = false,
  isSubmitting = false
}: TypstEditorProps) {
  const editorId = useId();

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
        <label htmlFor={editorId} className="font-medium text-[var(--text)]">
          Editor
        </label>
        <div className="flex flex-wrap gap-2 uppercase tracking-[0.16em]">
          <span>Shift+Enter skip</span>
        </div>
      </div>

      <div className="rounded-[16px] border border-[color:var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-center text-[10px] leading-5 text-[var(--muted)]">
        {inputMode === "math"
          ? "Math mode is on for this prompt: you can type x^2 + y^2 = z^2 without wrapping it in $...$."
          : "Text mode is on for this prompt: write normal Typst text/markup directly. Math delimiters are not needed by default here."}
      </div>

      <textarea
        id={editorId}
        className="min-h-[3.25rem] w-full rounded-[16px] border border-[color:var(--line)] bg-[var(--panel-strong)] p-3 text-center font-[var(--font-mono)] text-base leading-7 text-[var(--text)] outline-none transition placeholder:text-[var(--muted)] focus:border-[color:var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter" || !event.shiftKey) {
            return;
          }

          event.preventDefault();
          onSkip();
        }}
        placeholder="Type the Typst source that recreates the target render..."
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />

      <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>{value.length} characters</span>
        <span>{isSubmitting ? "Submitting..." : "Draft autosaves while this round is active."}</span>
      </div>
    </div>
  );
}
