import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface RenderWorkspace {
  rootDir: string;
  inputPath: string;
  outputPath: string;
}

export async function createRenderWorkspace(tempRootDir?: string): Promise<RenderWorkspace> {
  const baseDir = tempRootDir ?? os.tmpdir();
  await mkdir(baseDir, { recursive: true });
  const rootDir = await mkdtemp(path.join(baseDir, "typ-nique-render-"));

  return {
    rootDir,
    inputPath: path.join(rootDir, "main.typ"),
    outputPath: path.join(rootDir, "main.svg")
  };
}

export async function writeRenderSource(workspace: RenderWorkspace, source: string) {
  await writeFile(workspace.inputPath, source, "utf8");
}

export async function cleanupRenderWorkspace(workspace: RenderWorkspace) {
  await rm(workspace.rootDir, {
    recursive: true,
    force: true
  });
}

export async function cleanupStaleRenderWorkspaces(options: {
  tempRootDir?: string;
  maxAgeMs: number;
}) {
  const baseDir = options.tempRootDir ?? os.tmpdir();
  const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const now = Date.now();

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("typ-nique-render-"))
      .map(async (entry) => {
        const fullPath = path.join(baseDir, entry.name);
        const details = await stat(fullPath).catch(() => null);

        if (!details) {
          return;
        }

        if (now - details.mtimeMs < options.maxAgeMs) {
          return;
        }

        await rm(fullPath, {
          recursive: true,
          force: true
        }).catch(() => undefined);
      })
  );
}
