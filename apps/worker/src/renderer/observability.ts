import type { RenderFailure, RenderRequest, RenderResult } from "./types.js";

type RenderFailureRecord = {
  requestId: string | null;
  purpose: RenderRequest["purpose"];
  errorCode: RenderFailure["errorCode"];
  message: string;
  sourceHash?: string;
  durationMs: number;
  cached: boolean;
  at: string;
};

const MAX_FAILURES = 100;

const stats = {
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  cacheHits: 0
};

const recentFailures: RenderFailureRecord[] = [];

export function recordRenderResult(request: RenderRequest, result: RenderResult) {
  stats.totalRequests += 1;

  if (result.cached) {
    stats.cacheHits += 1;
  }

  if (result.ok) {
    stats.successCount += 1;
    return;
  }

  stats.failureCount += 1;
  recentFailures.unshift({
    requestId: request.requestId ?? null,
    purpose: request.purpose,
    errorCode: result.errorCode,
    message: result.message,
    sourceHash: result.sourceHash,
    durationMs: result.durationMs,
    cached: result.cached,
    at: new Date().toISOString()
  });

  if (recentFailures.length > MAX_FAILURES) {
    recentFailures.length = MAX_FAILURES;
  }
}

export function getRenderObservabilitySnapshot() {
  return {
    stats: { ...stats },
    recentFailures: [...recentFailures]
  };
}
