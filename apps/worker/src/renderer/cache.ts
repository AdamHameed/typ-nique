import type { RenderResult } from "./types.js";

interface CacheEntry {
  expiresAt: number;
  value: RenderResult;
}

const cache = new Map<string, CacheEntry>();
let maxEntries = 500;

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
  pruneExpiredEntries();

  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

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

export function configureRenderCache(options: { maxEntries: number }) {
  maxEntries = Math.max(10, options.maxEntries);
  pruneExpiredEntries();
}

export function getRenderCacheState() {
  pruneExpiredEntries();
  return {
    entries: cache.size,
    maxEntries
  };
}

function pruneExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}
