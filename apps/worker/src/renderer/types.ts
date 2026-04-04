export type RenderPurpose = "canonical" | "submission";

export type RenderErrorCode =
  | "SOURCE_TOO_LARGE"
  | "UNSAFE_SOURCE"
  | "RATE_LIMITED"
  | "BUSY"
  | "TIMEOUT"
  | "COMPILER_NOT_FOUND"
  | "COMPILE_ERROR"
  | "SVG_NOT_PRODUCED"
  | "OUTPUT_TOO_LARGE"
  | "INTERNAL_ERROR";

export interface RenderRequest {
  source: string;
  purpose: RenderPurpose;
  requestId?: string;
}

export interface RenderSuccess {
  ok: true;
  sourceHash: string;
  renderHash: string;
  svg: string;
  normalizedSvg: string;
  cached: boolean;
  durationMs: number;
  stderr: string;
  metadata: {
    purpose: RenderPurpose;
    outputBytes: number;
    compilerCommand: string;
  };
}

export interface RenderFailure {
  ok: false;
  errorCode: RenderErrorCode;
  message: string;
  safeMessage?: string;
  cached: boolean;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  sourceHash?: string;
}

export type RenderResult = RenderSuccess | RenderFailure;
