import { LeaderboardTable } from "../../components/leaderboard-table";
import { PageHeader } from "../../components/page-header";
import { SiteShell } from "../../components/site-shell";
import { getDailyLeaderboard } from "../../lib/api";

export default async function LeaderboardPage() {
  const leaderboard = await getDailyLeaderboard().catch(() => ({ data: [] }));

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Competition"
        title="Daily leaderboard"
        description="The scaffold keeps leaderboard reads separate from gameplay writes so this can evolve into daily challenges, ranked modes, and multiplayer-derived score views."
      />
      <LeaderboardTable entries={leaderboard.data} />
    </SiteShell>
  );
}
