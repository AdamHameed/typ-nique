import { loadChallengePack } from "./lib.js";

async function main() {
  const pack = await loadChallengePack();
  const counts = pack.challenges.reduce<Record<string, number>>((accumulator, challenge) => {
    accumulator[challenge.category] = (accumulator[challenge.category] ?? 0) + 1;
    return accumulator;
  }, {});

  console.log(`Validated pack "${pack.pack.title}" with ${pack.challenges.length} challenges.`);
  console.table(counts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
