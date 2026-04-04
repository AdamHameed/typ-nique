import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { RenderWorkspace } from "./temp-workspace.js";

export interface CompilerProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  svg: string | null;
}

export async function runTypstCompile(params: {
  typstBin: string;
  workspace: RenderWorkspace;
  timeoutMs: number;
  maxLogBytes: number;
  maxMemoryKb: number;
}): Promise<CompilerProcessResult> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const command = [
      `ulimit -v ${params.maxMemoryKb} >/dev/null 2>&1 || true`,
      `exec "${params.typstBin}" compile "${params.workspace.inputPath}" "${params.workspace.outputPath}" --format svg`
    ].join("; ");

    const child = spawn(
      "bash",
      ["-lc", command],
      {
        cwd: params.workspace.rootDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME
        }
      }
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, params.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = truncateLog(stdout + String(chunk), params.maxLogBytes);
    });

    child.stderr.on("data", (chunk) => {
      stderr = truncateLog(stderr + String(chunk), params.maxLogBytes);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", async (exitCode) => {
      clearTimeout(timer);

      let svg: string | null = null;

      try {
        svg = await readFile(params.workspace.outputPath, "utf8");
      } catch {
        svg = null;
      }

      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - startedAt,
        svg
      });
    });
  });
}

function truncateLog(value: string, maxBytes: number) {
  const buffer = Buffer.from(value, "utf8");

  if (buffer.byteLength <= maxBytes) {
    return value;
  }

  return buffer.subarray(0, maxBytes).toString("utf8");
}
