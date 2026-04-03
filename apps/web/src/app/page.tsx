import { Hero } from "../components/hero";
import { SiteShell } from "../components/site-shell";

export default function HomePage() {
  return (
    <SiteShell>
      <Hero />
    </SiteShell>
  );
}
