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
export type ChallengeInputMode = "math" | "text";
export type LeaderboardScope = "global" | "daily" | "weekly";
export type MultiplayerRoomStatus = "pending" | "countdown" | "active" | "completed" | "cancelled";
export type MultiplayerConnectionStatus = "connected" | "idle" | "disconnected" | "left";

export interface AuthUserView {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthSessionView {
  authenticated: boolean;
  guest: boolean;
  user: AuthUserView | null;
}

export interface ChallengePrompt {
  id: string;
  slug: string;
  title: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  inputMode: ChallengeInputMode;
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
    inputMode: ChallengeInputMode;
    normalizedCanonicalSource: string;
    acceptedAlternates: string[];
    renderedSvg: string;
    renderHash?: string;
  };
  score: number;
  streak: number;
  pointsAvailable: number;
  streakMultiplier: number;
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
  rank: number;
  runId: string;
  userName: string;
  score: number;
  accuracy: number;
  solvedCount?: number;
  isGuest?: boolean;
  mode?: "practice" | "daily";
  createdAt: string;
}

export interface PersonalRunView {
  runId: string;
  label: string;
  score: number;
  accuracy: number;
  solvedCount: number;
  endedAt: string;
}

export interface LeaderboardResponse {
  scope: LeaderboardScope;
  label: string;
  windowStart?: string;
  windowEnd?: string;
  entries: LeaderboardEntryView[];
}

export interface PersonalLeaderboardResponse {
  runId: string;
  bestScores: PersonalRunView[];
  recentRuns: PersonalRunView[];
  guestMode: boolean;
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
  mode: "practice" | "daily" | "multiplayer";
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
  mode: "practice" | "daily" | "multiplayer";
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

export interface PreviewRenderResponse {
  ok: boolean;
  svg?: string;
  renderHash?: string;
  matchesTarget?: boolean;
  matchTier?: MatchTier;
  effectiveSource?: string;
  autoWrappedMath?: boolean;
  inputMode?: ChallengeInputMode;
  durationMs?: number;
  cached?: boolean;
  errorCode?: string;
  message?: string;
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

export interface MultiplayerPlayerView {
  playerId: string;
  gameSessionId: string | null;
  userId: string | null;
  playerSessionId: string | null;
  displayName: string;
  connectionStatus: MultiplayerConnectionStatus;
  joinedAt: string;
  readyAt: string | null;
  leftAt: string | null;
  finishedAt: string | null;
  isHost: boolean;
  isReady: boolean;
  status: SessionStatus;
  finalPlace: number | null;
  score: number;
  solvedCount: number;
  attemptedCount: number;
  accuracy: number;
  completedRounds: number;
  currentRoundNumber: number;
}

export interface MultiplayerStandingEntry {
  rank: number;
  playerId: string;
  displayName: string;
  score: number;
  solvedCount: number;
  attemptedCount: number;
  accuracy: number;
  completedRounds: number;
  currentRoundNumber: number;
  finalPlace: number | null;
  finishedAt: string | null;
  isReady: boolean;
  isHost: boolean;
  status: SessionStatus;
}

export interface MultiplayerRoomState {
  id: string;
  roomCode: string;
  roomVersion: number;
  mode: "live";
  status: MultiplayerRoomStatus;
  createdAt: string;
  startedAt: string | null;
  raceStartsAt: string | null;
  countdownEndsAt: string | null;
  countdownRemainingMs: number;
  endedAt: string | null;
  maxPlayers: number;
  durationMinutes: number;
  startedRoundIndex: number;
  isLocked: boolean;
  localPlayerId: string | null;
  localSessionId: string | null;
  canStart: boolean;
  players: MultiplayerPlayerView[];
  standings: MultiplayerStandingEntry[];
  finalPlacements: MultiplayerStandingEntry[];
}

export interface MultiplayerRoomPreview {
  id: string;
  roomCode: string;
  status: MultiplayerRoomStatus;
  maxPlayers: number;
  durationMinutes: number;
  playerCount: number;
  hostDisplayName: string | null;
  createdAt: string;
  startedAt: string | null;
}

export interface MultiplayerReplayPlayerResult {
  playerId: string;
  gameSessionId: string | null;
  displayName: string;
  finalPlace: number | null;
  connectionStatus: MultiplayerConnectionStatus;
  score: number;
  solvedCount: number;
  attemptedCount: number;
  accuracy: number;
  completedRounds: number;
  currentRoundNumber: number;
  durationMs: number | null;
  finishedAt: string | null;
  rounds: RoundBreakdown[];
}

export interface MultiplayerReplayDiagnosticsPlayer {
  playerId: string;
  displayName: string;
  gameSessionId: string | null;
  connectionStatus: MultiplayerConnectionStatus;
  sessionStatus: SessionStatus;
  joinedAt: string;
  readyAt: string | null;
  leftAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  finalPlace: number | null;
  score: number;
  solvedCount: number;
  attemptedCount: number;
  completedRounds: number;
  currentRoundNumber: number;
}

export interface MultiplayerReplayDiagnostics {
  generatedAt: string;
  roomId: string;
  roomCode: string;
  roomVersion: number;
  roomStatus: MultiplayerRoomStatus;
  raceStartsAt: string | null;
  countdownEndsAt: string | null;
  finishedAt: string | null;
  playerCount: number;
  diagnosticsPlayers: MultiplayerReplayDiagnosticsPlayer[];
}

export interface MultiplayerRoomReplayData {
  room: MultiplayerRoomState;
  players: MultiplayerReplayPlayerResult[];
  diagnostics?: MultiplayerReplayDiagnostics | null;
}

export interface MultiplayerRoomSnapshotEventPayload {
  reason: string;
  room: MultiplayerRoomState;
  sessionState?: GameSessionState | null;
}

export interface MultiplayerRoomStandingsEventPayload {
  reason: string;
  standings: MultiplayerStandingEntry[];
}

export interface MultiplayerRoomCountdownEventPayload {
  reason: string;
  countdownEndsAt: string | null;
  countdownRemainingMs: number;
  raceStartsAt: string | null;
  startedRoundIndex: number;
  isLocked: boolean;
}

export interface MultiplayerRoomFinishedEventPayload {
  reason: string;
  finishedAt: string | null;
  placements: MultiplayerStandingEntry[];
}

export type MultiplayerGatewayClientEventType =
  | "room.subscribe"
  | "room.leave"
  | "player.ready"
  | "player.unready"
  | "player.heartbeat"
  | "room.start_countdown";

export type MultiplayerGatewayServerEventType =
  | "connection.ready"
  | "connection.heartbeat_ack"
  | "room.snapshot"
  | "room.countdown"
  | "room.standings"
  | "room.finished"
  | "room.left"
  | "room.error";

export interface MultiplayerGatewayClientEvent {
  type: MultiplayerGatewayClientEventType;
  roomVersion?: number;
  payload?:
    | {
        matchId?: string;
        roomCode?: string;
      }
    | Record<string, never>;
}

export interface MultiplayerGatewayServerEvent<TPayload = unknown> {
  type: MultiplayerGatewayServerEventType;
  roomId: string | null;
  roomVersion: number;
  eventSequence: number;
  occurredAt: string;
  payload: TPayload;
}

export function calculateTypstSourceBasePoints(source: string) {
  return Math.max(0, source.length * 5);
}

export function calculateStreakMultiplier(streak: number) {
  return Number(Math.min(2, 1 + Math.max(0, streak) * 0.1).toFixed(1));
}

export function calculateRoundPointValue(source: string, streak: number) {
  return Math.round(calculateTypstSourceBasePoints(source) * calculateStreakMultiplier(streak));
}
