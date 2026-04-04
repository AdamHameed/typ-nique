import { PlayClient } from "../../components/play-client";
import { SiteShell } from "../../components/site-shell";

export default function PlayPage({
  searchParams
}: {
  searchParams?: { mode?: string };
}) {
  const mode = searchParams?.mode === "daily" ? "daily" : "practice";

  return (
    <SiteShell>
      <PlayClient mode={mode} />
    </SiteShell>
  );
}
