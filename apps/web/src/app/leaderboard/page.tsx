import { LeaderboardTable } from "../../components/leaderboard-table";
import { PageHeader } from "../../components/page-header";
import { SiteShell } from "../../components/site-shell";
import { getLeaderboard, getPersonalLeaderboards } from "../../lib/api";

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams?: { runId?: string };
}) {
  const leaderboard = await getLeaderboard("weekly", 25).catch(() => null);
  const personal = searchParams?.runId ? await getPersonalLeaderboards(searchParams.runId, 5).catch(() => null) : null;

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Competition"
        title="Weekly Leaderboard"
        description="The top weekly scores, plus your personal bests and recent run history."
      />
      {leaderboard?.data ? (
        <LeaderboardTable board={leaderboard.data} personal={personal?.data ?? null} />
      ) : (
        <p className="texnique-note">Leaderboard data is unavailable right now.</p>
      )}
    </SiteShell>
  );
}
