"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Button, Card } from "@typ-nique/ui";
import { loginAccount, registerAccount } from "../lib/api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    startTransition(async () => {
      try {
        if (mode === "signup") {
          await registerAccount({
            username,
            email,
            password,
            displayName: displayName || undefined
          });
        } else {
          await loginAccount({
            identifier,
            password
          });
        }

        router.push("/play");
        router.refresh();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Authentication failed.");
      }
    });
  }

  return (
    <Card className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-4xl font-semibold text-[var(--text)]">{mode === "signup" ? "Create account" : "Log in"}</h1>
        <p className="mt-2 texnique-note">
          {mode === "signup"
            ? "Save your history, keep your rankings, and turn your current guest progress into a real account."
            : "Pick up your persistent history and personal bests without losing guest progress from this browser."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <>
            <Input label="Username" value={username} onChange={setUsername} autoComplete="username" />
            <Input label="Display name" value={displayName} onChange={setDisplayName} autoComplete="nickname" optional />
            <Input label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          </>
        ) : (
          <Input
            label="Email or username"
            value={identifier}
            onChange={setIdentifier}
            autoComplete="username"
          />
        )}
        <Input label="Password" value={password} onChange={setPassword} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} />

        {status ? (
          <div className="texnique-status texnique-status--error">
            {status}
          </div>
        ) : null}

        <Button type="submit" disabled={isPending} className="w-full justify-center px-4 py-3 text-base">
          {mode === "signup" ? "Create account" : "Log in"}
        </Button>
      </form>

      <p className="texnique-note">
        {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
        <Link href={mode === "signup" ? "/login" : "/signup"} className="text-[var(--text)] underline underline-offset-4">
          {mode === "signup" ? "Log in" : "Sign up"}
        </Link>
      </p>
    </Card>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  optional = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  optional?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">
        {label}
        {optional ? " (optional)" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="texnique-field"
      />
    </label>
  );
}
