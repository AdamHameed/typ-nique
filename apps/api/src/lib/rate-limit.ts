import type { FastifyReply } from "fastify";

type RateLimitBucket = {
  count: number;
  resetsAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetsAt: number;
};

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
    } satisfies RateLimitDecision;
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetsAt: bucket.resetsAt
    } satisfies RateLimitDecision;
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetsAt: bucket.resetsAt
  } satisfies RateLimitDecision;
}

export function buildRateLimitKey(scope: string, identity: string | null | undefined, fallback: string) {
  return `${scope}:${identity ?? fallback}`;
}

export function applyRateLimitHeaders(
  reply: FastifyReply,
  decision: RateLimitDecision,
  options: {
    limit: number;
    windowMs: number;
  }
) {
  const resetSeconds = Math.max(1, Math.ceil((decision.resetsAt - Date.now()) / 1000));

  reply.header("RateLimit-Limit", String(options.limit));
  reply.header("RateLimit-Remaining", String(decision.remaining));
  reply.header("RateLimit-Reset", String(resetSeconds));
  reply.header("RateLimit-Policy", `${options.limit};w=${Math.ceil(options.windowMs / 1000)}`);

  if (!decision.allowed) {
    reply.header("Retry-After", String(resetSeconds));
  }
}
