import { runCommand } from "./lib.js";

async function main() {
  const validate = await runCommand("pnpm", ["content:validate"]);

  if (validate.exitCode !== 0) {
    process.stdout.write(validate.stdout);
    process.stderr.write(validate.stderr);
    process.exit(validate.exitCode ?? 1);
  }

  process.stdout.write(validate.stdout);

  const seed = await runCommand("pnpm", ["db:seed"]);
  process.stdout.write(seed.stdout);
  process.stderr.write(seed.stderr);

  if (seed.exitCode !== 0) {
    process.exit(seed.exitCode ?? 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
