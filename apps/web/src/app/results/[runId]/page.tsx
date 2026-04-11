import { PageHeader } from "../../../components/page-header";
import { ResultsPageClient } from "../../../components/results-page-client";
import { SiteShell } from "../../../components/site-shell";

export default async function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const resolvedParams = await params;

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Results"
        title="Run Complete"
        description="Final score, pace, personal context, and the round-by-round record for the session."
      />
      <ResultsPageClient runId={resolvedParams.runId} />
    </SiteShell>
  );
}
