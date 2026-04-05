import type { ChallengePrompt, LeaderboardEntryView } from "@typ-nique/types";
import { Button, Card } from "@typ-nique/ui";
import Link from "next/link";
import { optimizeTypstSvgForSnippet } from "../lib/typst-snippet";
import { TypstSnippet } from "./typst-snippet";

export function DailyChallengePanel({
  challenge,
  leaders
}: {
  challenge: ChallengePrompt | null;
  leaders: LeaderboardEntryView[];
}) {
  const optimizedRender = challenge?.renderedSvg ? optimizeTypstSvgForSnippet(challenge.renderedSvg) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">Today&apos;s prompt</p>
            <h2 className="mt-2 text-4xl font-semibold text-[var(--text)]">{challenge?.title ?? "Daily challenge unavailable"}</h2>
          </div>
          <div className="border-2 border-[color:var(--text)] px-3 py-1 text-sm text-[var(--muted)]">
            {challenge?.difficulty ?? "n/a"}
          </div>
        </div>
        <p className="texnique-note">
          Everyone gets the same rendered target and the same three-minute clock. Fastest accurate source reconstruction wins.
        </p>
        <div className="texnique-math-display h-[13rem] sm:h-[15rem]">
          {optimizedRender ? (
            <TypstSnippet svg={optimizedRender} />
          ) : (
            <div className="texnique-preview-placeholder">No daily render available.</div>
          )}
        </div>
        <Link href="/play?mode=daily">
          <Button className="px-6 py-3 text-base">Play The Daily</Button>
        </Link>
      </Card>
      <Card className="space-y-4">
        <div>
          <p className="text-sm text-[var(--muted)]">Today&apos;s leaders</p>
          <h3 className="mt-2 text-3xl font-semibold text-[var(--text)]">Current podium</h3>
        </div>
        <div className="texnique-list">
          {leaders.slice(0, 5).map((entry, index) => (
            <div key={`${entry.userName}-${index}`} className="texnique-list-item flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-medium text-[var(--text)]">
                  {index + 1}. {entry.userName}
                </p>
                <p className="text-sm text-[var(--muted)]">{Math.round(entry.accuracy * 100)}% accuracy</p>
              </div>
              <p className="text-2xl font-semibold text-[var(--text)]">{entry.score}</p>
            </div>
          ))}
          {leaders.length === 0 ? <p className="texnique-note">No daily scores yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
