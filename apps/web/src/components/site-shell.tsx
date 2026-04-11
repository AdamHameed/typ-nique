import Link from "next/link";
import type { PropsWithChildren } from "react";
import { featureFlags } from "../lib/features";
import { AuthControls } from "./auth-controls";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/play", label: "Play" },
  { href: "/multiplayer", label: "Multiplayer" },
  { href: "/leaderboard", label: "Leaderboard" }
] as const;

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="texnique-shell bg-[var(--background)] text-[var(--text)]">
      <div className="texnique-shell-inner">
        <header className="texnique-shell-header">
          <div className="texnique-shell-brand">
            <Link href="/">Typ-Nique</Link>
            <p className="texnique-shell-tagline">A Typst Typesetting Game</p>
          </div>
          <nav className="texnique-shell-nav">
            {navItems.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="texnique-nav-link"
              >
                {item.label}
              </Link>
            ))}
            {featureFlags.dailyMode ? (
              <Link href="/daily" className="texnique-nav-link">
                Daily
              </Link>
            ) : null}
            {navItems.slice(2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="texnique-nav-link"
              >
                {item.label}
              </Link>
            ))}
            <AuthControls />
            <ThemeToggle />
          </nav>
        </header>
        <main className="texnique-shell-main">{children}</main>
      </div>
    </div>
  );
}
