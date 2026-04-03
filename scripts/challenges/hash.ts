import { computeRenderHash, loadChallengePack, saveChallengePack } from "./lib.js";

async function main() {
  const pack = await loadChallengePack();

  for (const challenge of pack.challenges) {
    if (!challenge.target_render_svg) {
      continue;
    }

    challenge.target_render_hash = computeRenderHash(challenge.target_render_svg);
    console.log(`Hashed ${challenge.slug}`);
  }

  await saveChallengePack(pack);
  console.log("Canonical render hashes updated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
