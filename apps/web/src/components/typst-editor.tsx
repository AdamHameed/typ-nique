"use client";

import { useId } from "react";
import type { ChallengeInputMode } from "@typ-nique/types";

interface TypstEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  inputMode: ChallengeInputMode;
  disabled?: boolean;
  isSubmitting?: boolean;
}

export function TypstEditor({
  value,
  onChange,
  onSubmit,
  onSkip,
  inputMode,
  disabled = false,
  isSubmitting = false
}: TypstEditorProps) {
  const editorId = useId();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <label htmlFor={editorId} className="font-medium text-white">
          Typst Editor
        </label>
        <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
          <span>Cmd/Ctrl + Enter submit</span>
          <span>Cmd/Ctrl + Shift + Enter skip</span>
        </div>
      </div>

      <div
        className={`rounded-[20px] border px-4 py-3 text-xs leading-6 ${
          inputMode === "math"
            ? "border-cyan-300/12 bg-cyan-300/8 text-cyan-100"
            : "border-violet-300/12 bg-violet-300/8 text-violet-100"
        }`}
      >
        {inputMode === "math"
          ? "Math mode is on for this prompt: you can type x^2 + y^2 = z^2 without wrapping it in $...$."
          : "Text mode is on for this prompt: write normal Typst text/markup directly. Math delimiters are not needed by default here."}
      </div>

      <textarea
        id={editorId}
        className="min-h-[25rem] w-full rounded-[26px] border border-white/8 bg-slate-950/85 p-5 font-[var(--font-mono)] text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
            return;
          }

          event.preventDefault();

          if (event.shiftKey) {
            onSkip();
            return;
          }

          onSubmit();
        }}
        placeholder="Type the Typst source that recreates the target render..."
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{value.length} characters</span>
        <span>{isSubmitting ? "Submitting..." : "Draft autosaves while this round is active."}</span>
      </div>
    </div>
  );
}
