export type ChallengeCategory = ChallengeContentCategory;
export type ChallengeDifficulty = "easy" | "medium" | "hard";
export type ChallengeContentCategory =
  | "basic-math"
  | "fractions"
  | "superscripts-subscripts"
  | "matrices"
  | "alignment-layout"
  | "symbols"
  | "text-formatting"
  | "mixed-expressions";
export type ChallengeContentStatus = "active" | "inactive";

export type MatchTier = "exact" | "normalized" | "rendered" | "alternate" | "none";
export type SubmissionVerdict = "correct" | "incorrect" | "compile_error";
export type SessionStatus = "pending" | "active" | "completed" | "abandoned";

export interface ChallengePrompt {
  id: string;
  slug: string;
  title: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  canonicalSource: string;
  normalizedCanonicalSource: string;
  renderedSvg?: string;
  acceptedAlternates: string[];
}

export interface ChallengeRoundPayload {
  sessionId: string;
  roundId: string;
  challenge: {
    id: string;
    slug: string;
    title: string;
    category: ChallengeCategory;
    difficulty: ChallengeDifficulty;
    renderedSvg: string;
  };
  score: number;
  streak: number;
  roundNumber: number;
  timeRemainingMs?: number;
}

export interface SubmissionCheckResult {
  verdict: SubmissionVerdict;
  matchTier: MatchTier;
  normalizedSource: string;
  feedback: string;
  compileError?: string;
  renderFingerprint?: string;
}

export interface LeaderboardEntryView {
  userName: string;
  score: number;
  accuracy: number;
  createdAt: string;
}

export interface RoundBreakdown {
  roundId: string;
  position: number;
  challengeId: string;
  challengeTitle: string;
  challengeSlug: string;
  difficulty: ChallengeDifficulty;
  verdict: SubmissionVerdict | "skipped" | "pending";
  matchTier: MatchTier;
  scoreAwarded: number;
  submittedSource?: string;
  feedback?: string;
  explanation?: string;
  timeTakenMs?: number | null;
}

export interface GameSessionState {
  id: string;
  status: SessionStatus;
  mode: "practice" | "daily";
  startedAt: string;
  endsAt: string;
  durationMs: number;
  timeRemainingMs: number;
  score: number;
  solvedCount: number;
  accuracy: number;
  attemptedCount: number;
  streak: number;
  currentRound: ChallengeRoundPayload | null;
  lastResult?: {
    verdict: SubmissionVerdict | "skipped";
    matchTier: MatchTier;
    scoreAwarded: number;
    feedback: string;
  } | null;
}

export interface GameSessionResult {
  id: string;
  status: SessionStatus;
  mode: "practice" | "daily";
  score: number;
  solvedCount: number;
  attemptedCount: number;
  accuracy: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  rounds: RoundBreakdown[];
}

export interface SubmissionOutcome {
  verdict: SubmissionVerdict;
  matchTier: MatchTier;
  normalizedSource: string;
  feedback: string;
  explanation?: string;
  compileError?: string;
  renderFingerprint?: string;
  queuedRenderCheck?: boolean;
  scoreAwarded?: number;
  sessionState?: GameSessionState;
}

export interface ChallengeContentEntry {
  id: string;
  title: string;
  slug: string;
  difficulty: ChallengeDifficulty;
  category: ChallengeContentCategory;
  tags: string[];
  canonical_typst_source: string;
  accepted_alternate_sources: string[];
  target_render_svg: string | null;
  target_render_hash: string | null;
  estimated_solve_time: number;
  hint: string;
  explanation: string;
  status: ChallengeContentStatus;
}

export interface ChallengeContentPack {
  version: number;
  pack: {
    id: string;
    title: string;
    description: string;
  };
  challenges: ChallengeContentEntry[];
}
