/**
 * Real remaining-time budget for spin activities.
 * Default cutoff 21:00 local — spin durations are clamped so they fit
 * before guitar/evening, not fake fixed receipts.
 */

export const DEFAULT_CUTOFF_HM = '21:00';

/** Minutes from now until cutoff today. 0 if already past. */
export function minutesUntilCutoff(
  now: Date = new Date(),
  cutoffHm: string = DEFAULT_CUTOFF_HM
): number {
  const [h, m] = cutoffHm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  const end = new Date(now);
  end.setHours(h, m, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

/**
 * Planned duration for a spun option:
 * - if option has durationMinutes, use min(option, remaining until cutoff)
 * - if no option duration, use remaining until cutoff (at least 5 min if any time left)
 * - if past cutoff, return 0 (user can still log freely)
 */
export function planSpinDuration(
  optionMinutes: number | undefined | null,
  now: Date = new Date(),
  cutoffHm: string = DEFAULT_CUTOFF_HM
): { plannedMinutes: number; remainingUntilCutoff: number; capped: boolean } {
  const remaining = minutesUntilCutoff(now, cutoffHm);
  if (remaining <= 0) {
    return {
      plannedMinutes: optionMinutes && optionMinutes > 0 ? optionMinutes : 0,
      remainingUntilCutoff: 0,
      capped: false,
    };
  }
  if (optionMinutes && optionMinutes > 0) {
    const planned = Math.min(optionMinutes, remaining);
    return {
      plannedMinutes: planned,
      remainingUntilCutoff: remaining,
      capped: planned < optionMinutes,
    };
  }
  return {
    plannedMinutes: Math.max(5, remaining),
    remainingUntilCutoff: remaining,
    capped: false,
  };
}

export function formatMinutes(m: number): string {
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}
