import { PageHeader } from "../../../components/page-header";
import { ResultsPageClient } from "../../../components/results-page-client";
import { SiteShell } from "../../../components/site-shell";

export default function ResultsPage({ params }: { params: { runId: string } }) {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Results"
        title="Run Complete"
        description="Final score, pace, personal context, and the round-by-round record for the session."
      />
      <ResultsPageClient runId={params.runId} />
    </SiteShell>
  );
}
