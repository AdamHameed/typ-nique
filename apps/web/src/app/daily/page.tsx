import { DailyChallengePanel } from "../../components/daily-challenge-panel";
import { PageHeader } from "../../components/page-header";
import { SiteShell } from "../../components/site-shell";
import { getDailyChallenge, getDailyLeaderboard } from "../../lib/api";

export default async function DailyPage() {
  const [challenge, leaderboard] = await Promise.all([
    getDailyChallenge().catch(() => ({ data: null })),
    getDailyLeaderboard().catch(() => ({ data: [] }))
  ]);

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Daily"
        title="Same prompt. Same clock. New leaderboard."
        description="The daily mode spotlights one shared challenge and turns the game into a race for accuracy, speed, and consistency."
      />
      <DailyChallengePanel challenge={challenge.data} leaders={leaderboard.data} />
    </SiteShell>
  );
}
