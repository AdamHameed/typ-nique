"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { AuthSessionView } from "@typ-nique/types";
import { getAuthSession, logoutAccount } from "../lib/api";

export function AuthControls() {
  const [session, setSession] = useState<AuthSessionView | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void getAuthSession()
      .then((response) => setSession(response.data))
      .catch(() =>
        setSession({
          authenticated: false,
          guest: true,
          user: null
        })
      );
  }, []);

  if (!session?.authenticated) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--text)]"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-[color:var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--panel)]"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--muted)]">{session.user?.displayName ?? session.user?.username}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await logoutAccount().catch(() => null);
            setSession({
              authenticated: false,
              guest: true,
              user: null
            });
          })
        }
        className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--text)] disabled:opacity-50"
      >
        Log out
      </button>
    </div>
  );
}
