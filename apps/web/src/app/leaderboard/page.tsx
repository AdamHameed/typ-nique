import { LeaderboardTable } from "../../components/leaderboard-table";
import { PageHeader } from "../../components/page-header";
import { SiteShell } from "../../components/site-shell";
import { getLeaderboard, getPersonalLeaderboards } from "../../lib/api";

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams?: { scope?: string; runId?: string };
}) {
  const requestedScope = searchParams?.scope;
  const activeScope = requestedScope === "global" || requestedScope === "weekly" || requestedScope === "daily" ? requestedScope : "daily";
  const leaderboard = await getLeaderboard(activeScope, 25).catch(() => null);
  const personal = searchParams?.runId ? await getPersonalLeaderboards(searchParams.runId, 5).catch(() => null) : null;

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Competition"
        title="Leaderboard"
        description="Global, daily, and weekly boards with personal bests and recent-run history. Practical now, ready to scale later."
      />
      {leaderboard?.data ? (
        <LeaderboardTable board={leaderboard.data} personal={personal?.data ?? null} activeScope={activeScope} />
      ) : (
        <p className="text-slate-300">Leaderboard data is unavailable right now.</p>
      )}
    </SiteShell>
  );
}
