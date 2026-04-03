import { PageHeader } from "../../../components/page-header";
import { ResultsOverview } from "../../../components/results-overview";
import { SiteShell } from "../../../components/site-shell";
import { getSessionResults } from "../../../lib/api";

export default async function ResultsPage({ params }: { params: { runId: string } }) {
  const result = await getSessionResults(params.runId).catch(() => null);

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Results"
        title={`Run ${params.runId}`}
        description="Final score, solved count, accuracy, and the round-by-round record for the session."
      />
      {result?.data ? <ResultsOverview result={result.data} /> : <p className="text-slate-300">Result not found.</p>}
    </SiteShell>
  );
}
