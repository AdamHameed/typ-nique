"use client";

import { useEffect, useId, useRef } from "react";
import type { ChallengeInputMode } from "@typ-nique/types";

interface TypstEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onSkip?: () => void;
  inputMode: ChallengeInputMode;
  disabled?: boolean;
  isSubmitting?: boolean;
  autoFocusKey?: string;
}

export function TypstEditor({
  value,
  onChange,
  onSubmit,
  onSkip,
  inputMode,
  disabled = false,
  isSubmitting = false,
  autoFocusKey
}: TypstEditorProps) {
  const editorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const focusId = window.requestAnimationFrame(() => {
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    });

    return () => {
      window.cancelAnimationFrame(focusId);
    };
  }, [autoFocusKey, disabled]);

  return (
    <div className="texnique-editor">
      <div className="texnique-editor-meta">
        <label htmlFor={editorId}>
          Edit your code here
        </label>
        <span>No delimiters needed</span>
      </div>
      <textarea
        id={editorId}
        ref={textareaRef}
        className="texnique-source"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (disabled || isSubmitting) {
            return;
          }

          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit?.();
            return;
          }

          if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            onSkip?.();
          }
        }}
        placeholder="Type the Typst source that recreates the target render..."
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />

      <div className="texnique-editor-meta">
        <span>{value.length} characters</span>
        <span>{isSubmitting ? "Submitting..." : "Enter submits · Shift+Enter skips"}</span>
      </div>
    </div>
  );
}
