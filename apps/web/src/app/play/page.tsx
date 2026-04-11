import { PlayClient } from "../../components/play-client";
import { featureFlags } from "../../lib/features";

export default async function PlayPage({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const mode = featureFlags.dailyMode && resolvedSearchParams?.mode === "daily" ? "daily" : "practice";

  return <PlayClient mode={mode} />;
}
