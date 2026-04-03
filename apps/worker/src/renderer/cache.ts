import type { RenderResult } from "./types.js";

interface CacheEntry {
  expiresAt: number;
  value: RenderResult;
}

const cache = new Map<string, CacheEntry>();

export function getCachedRenderResult(key: string): RenderResult | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return {
    ...entry.value,
    cached: true
  };
}

export function setCachedRenderResult(key: string, value: RenderResult, ttlMs: number) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value: {
      ...value,
      cached: false
    }
  });
}

export function clearRenderCache() {
  cache.clear();
}
