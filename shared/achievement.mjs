/** Financial achievement is uncapped; missing actual/positive target is unavailable. */
export function achievementPercent(actual, target) {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return Math.round(actual / target * 100);
}
