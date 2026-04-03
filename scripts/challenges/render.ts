import { computeRenderHash, compileTypstToSvg, loadChallengePack, renderPlaceholderSvg, saveChallengePack } from "./lib.js";

async function main() {
  const usePlaceholder = process.argv.includes("--placeholder");
  const force = process.argv.includes("--force");
  const pack = await loadChallengePack();

  for (const challenge of pack.challenges) {
    if (!force && challenge.target_render_svg) {
      continue;
    }

    const svg = usePlaceholder
      ? renderPlaceholderSvg(challenge.title, challenge.canonical_typst_source)
      : await compileTypstToSvg(challenge.canonical_typst_source, challenge.title);

    challenge.target_render_svg = svg;
    challenge.target_render_hash = computeRenderHash(svg);
    console.log(`Rendered ${challenge.slug}`);
  }

  await saveChallengePack(pack);
  console.log("Challenge SVG rendering complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
