import type { ChallengePrompt, LeaderboardEntryView } from "@typ-nique/types";
import { Button, Card } from "@typ-nique/ui";
import Link from "next/link";

export function DailyChallengePanel({
  challenge,
  leaders
}: {
  challenge: ChallengePrompt | null;
  leaders: LeaderboardEntryView[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,0.92fr]">
      <Card className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Today’s prompt</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{challenge?.title ?? "Daily challenge unavailable"}</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
            {challenge?.difficulty ?? "n/a"}
          </div>
        </div>
        <p className="text-sm leading-7 text-slate-300">
          Everyone gets the same rendered target and the same three-minute clock. Fastest accurate source reconstruction wins.
        </p>
        <div className="rounded-[26px] border border-white/8 bg-white p-4 shadow-inner sm:p-6">
          {challenge?.renderedSvg ? (
            <div className="overflow-auto rounded-2xl" dangerouslySetInnerHTML={{ __html: challenge.renderedSvg }} />
          ) : (
            <div className="flex h-60 items-center justify-center text-slate-500">No daily render available.</div>
          )}
        </div>
        <Link href="/play">
          <Button className="px-6 py-3 text-base">Play The Daily</Button>
        </Link>
      </Card>
      <Card className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Today’s leaders</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Current podium</h3>
        </div>
        <div className="space-y-3">
          {leaders.slice(0, 5).map((entry, index) => (
            <div key={`${entry.userName}-${index}`} className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/5 px-4 py-3">
              <div>
                <p className="font-medium text-white">
                  {index + 1}. {entry.userName}
                </p>
                <p className="text-sm text-slate-400">{Math.round(entry.accuracy * 100)}% accuracy</p>
              </div>
              <p className="text-lg font-semibold text-cyan-200">{entry.score}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
