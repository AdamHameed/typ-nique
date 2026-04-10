import { LeaderboardTable } from "../../components/leaderboard-table";
import { PageHeader } from "../../components/page-header";
import { SiteShell } from "../../components/site-shell";
import { getLeaderboard, getPersonalLeaderboards } from "../../lib/api";

export const dynamic = "force-dynamic";

const scopeContent = {
  global: {
    title: "All-Time Leaderboard",
    description: "The strongest runs across the full lifetime of the game, plus your personal bests and recent run history."
  },
  weekly: {
    title: "Weekly Leaderboard",
    description: "The top scores from the current weekly window, plus your personal bests and recent run history."
  },
  daily: {
    title: "Daily Leaderboard",
    description: "Today’s fastest climbers, plus your personal bests and recent run history."
  }
} as const;

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams?: Promise<{ runId?: string; scope?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope =
    resolvedSearchParams?.scope === "global" || resolvedSearchParams?.scope === "daily" || resolvedSearchParams?.scope === "weekly"
      ? resolvedSearchParams.scope
    : "weekly";
  const leaderboard = await getLeaderboard(scope, 25).catch(() => null);
  const personal = resolvedSearchParams?.runId ? await getPersonalLeaderboards(resolvedSearchParams.runId, 5).catch(() => null) : null;
  const copy = scopeContent[scope];

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Competition"
        title={copy.title}
        description={copy.description}
      />
      {leaderboard?.data ? (
        <LeaderboardTable board={leaderboard.data} personal={personal?.data ?? null} />
      ) : (
        <p className="texnique-note">Leaderboard data is unavailable right now.</p>
      )}
    </SiteShell>
  );
}
