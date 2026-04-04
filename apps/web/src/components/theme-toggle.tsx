"use client";

import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark";

const STORAGE_KEY = "typ-nique:theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextTheme: ThemePreference =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    applyTheme(nextTheme);
    setTheme(nextTheme);
  }, []);

  function applyTheme(nextTheme: ThemePreference) {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  function handleToggle() {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--text)]"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
