type RateLimitBucket = {
  count: number;
  resetsAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetsAt) {
    const nextBucket = {
      count: 1,
      resetsAt: now + windowMs
    };
    buckets.set(key, nextBucket);
    return {
      allowed: true,
      remaining: limit - 1,
      resetsAt: nextBucket.resetsAt
    };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetsAt: bucket.resetsAt
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetsAt: bucket.resetsAt
  };
}

export function buildRateLimitKey(scope: string, identity: string | null | undefined, fallback: string) {
  return `${scope}:${identity ?? fallback}`;
}
