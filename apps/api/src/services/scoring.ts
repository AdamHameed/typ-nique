export function scoreSubmission(difficulty: number, presentedAt: Date, now = Date.now()) {
  const difficultyBase = difficulty <= 1 ? 100 : difficulty === 2 ? 150 : 220;
  const elapsedSeconds = Math.max(1, (now - presentedAt.getTime()) / 1000);
  const speedBonus = Math.max(0.55, Math.min(1.25, 20 / elapsedSeconds));

  return Math.round(difficultyBase * speedBonus);
}
