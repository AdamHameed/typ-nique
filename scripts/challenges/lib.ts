import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { challengeContentPackSchema } from "@typ-nique/validation";
import { createPlaceholderSvg, normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";

export const challengePackPath = path.resolve(process.cwd(), "data/challenges/core-pack.json");

export async function loadChallengePack() {
  const raw = await readFile(challengePackPath, "utf8");
  return challengeContentPackSchema.parse(JSON.parse(raw));
}

export async function saveChallengePack(pack: unknown) {
  await writeFile(challengePackPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
}

export function computeRenderHash(svg: string) {
  return svgFingerprint(normalizeSvgMarkup(svg));
}

export async function compileTypstToSvg(source: string, title: string) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "typ-nique-content-"));
  const inputPath = path.join(tempDir, "challenge.typ");
  const outputPath = path.join(tempDir, "challenge.svg");

  try {
    await writeFile(inputPath, source, "utf8");

    const result = await runCommand("typst", ["compile", inputPath, outputPath, "--format", "svg"]);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || `Typst exited with code ${result.exitCode}`);
    }

    return await readFile(outputPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Typst CLI was not found while rendering "${title}". Install Typst or rerun with --placeholder.`
      );
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function renderPlaceholderSvg(title: string, source: string) {
  return createPlaceholderSvg(title, source.replace(/\n/g, " ").slice(0, 64));
}

export async function runCommand(command: string, args: string[]) {
  return new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
