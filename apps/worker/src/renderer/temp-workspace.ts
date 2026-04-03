import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface RenderWorkspace {
  rootDir: string;
  inputPath: string;
  outputPath: string;
}

export async function createRenderWorkspace(tempRootDir?: string): Promise<RenderWorkspace> {
  const baseDir = tempRootDir ?? os.tmpdir();
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
