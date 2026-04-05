import { PlayClient } from "../../components/play-client";
import { featureFlags } from "../../lib/features";

export default function PlayPage({
  searchParams
}: {
  searchParams?: { mode?: string };
}) {
  const mode = featureFlags.dailyMode && searchParams?.mode === "daily" ? "daily" : "practice";

  return <PlayClient mode={mode} />;
}
