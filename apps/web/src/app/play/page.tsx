import { PageHeader } from "../../components/page-header";
import { PlayClient } from "../../components/play-client";
import { SiteShell } from "../../components/site-shell";

export default function PlayPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Live Run"
        title="Fast, fair Typst rounds."
        description="Three minutes, one Typst prompt at a time. Submit, skip, recover after refresh, and finish with a per-problem breakdown."
      />
      <PlayClient />
    </SiteShell>
  );
}
