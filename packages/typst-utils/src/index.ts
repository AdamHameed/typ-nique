import { createHash } from "node:crypto";

export function normalizeSource(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .trim();
}

export function normalizeSvgMarkup(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s*id="[^"]*"/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

export function svgFingerprint(svg: string): string {
  return createHash("sha256").update(svg).digest("hex");
}

export function createPlaceholderSvg(title: string, body: string): string {
  const safeTitle = title.replace(/"/g, "&quot;");
  const safeBody = body.replace(/"/g, "&quot;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="140" viewBox="0 0 560 140" role="img" aria-label="${safeTitle}"><rect width="560" height="140" rx="24" fill="#0f172a"/><text x="32" y="56" fill="#f8fafc" font-family="monospace" font-size="18">${safeTitle}</text><text x="32" y="92" fill="#94a3b8" font-family="monospace" font-size="16">${safeBody}</text></svg>`;
}
