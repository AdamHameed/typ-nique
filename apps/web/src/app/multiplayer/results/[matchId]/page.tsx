import { PageHeader } from "../../../../components/page-header";
import { MultiplayerResultsClient } from "../../../../components/multiplayer-results-client";
import { SiteShell } from "../../../../components/site-shell";
import { multiplayerDiagnosticsEnabled } from "../../../../lib/runtime-flags";

export default async function MultiplayerResultsPage({
  params,
  searchParams
}: {
  params: Promise<{ matchId: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const includeDiagnostics = multiplayerDiagnosticsEnabled && resolvedSearchParams?.view === "debug";

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Multiplayer Results"
        title="Race Replay"
        description="Final placements, scores, and round outcomes for completed multiplayer races."
      />
      <MultiplayerResultsClient matchId={resolvedParams.matchId} includeDiagnostics={includeDiagnostics} />
    </SiteShell>
  );
}
