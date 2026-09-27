/**
 * Deterministic free-time + Spin budget engine.
 * No AI — pure clock math against fixed routines and college status.
 *
 * Rules:
 * - Weekday free window = max(now, homeArrival/left-early) → next fixed routine
 *   (default next home routine ~19:30 when college early-leave).
 * - Weekend Spin window runs from actual weekend wake until 22:00 hard cutoff.
 * - Never schedule an activity past the window end unless it is a fixed night routine.
 * - Short remaining time → only short-duration options are eligible.
 */

export const DEFAULT_WEEKDAY_CUTOFF_HM = '21:00';
/** Hard cutoff for Saturday/Sunday Spin system. */
export const WEEKEND_SPIN_CUTOFF_HM = '22:00';
/** Typical next fixed home routine after college (user-editable via routines). */
export const DEFAULT_NEXT_FIXED_HM = '19:30';
/** Minimum free window (minutes) before offering Spin. */
export const MIN_FREE_WINDOW_MINUTES = 15;
/** Activities at or below this duration are "short" options. */
export const SHORT_ACTIVITY_MAX_MINUTES = 45;

export function parseHm(hm: string): { h: number; m: number } | null {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

export function hmToMinutes(hm: string): number | null {
  const p = parseHm(hm);
  if (!p) return null;
  return p.h * 60 + p.m;
}

export function minutesToHm(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 60) % 24;
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dateAtHm(base: Date, hm: string): Date | null {
  const p = parseHm(hm);
  if (!p) return null;
  const d = new Date(base);
  d.setHours(p.h, p.m, 0, 0);
  return d;
}

/** Minutes from now until cutoff today. 0 if already past. */
export function minutesUntilCutoff(
  now: Date = new Date(),
  cutoffHm: string = DEFAULT_WEEKDAY_CUTOFF_HM
): number {
  const end = dateAtHm(now, cutoffHm);
  if (!end) return 0;
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

export function formatMinutes(m: number): string {
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function isWeekend(d: Date = new Date()): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export interface FreeTimeWindow {
  /** Whether a free-time spin window is active now. */
  active: boolean;
  /** Start of free window ("HH:mm"). */
  startHm: string;
  /** End of free window / hard cutoff ("HH:mm"). */
  endHm: string;
  /** Remaining minutes from `now` until end. */
  remainingMinutes: number;
  /** Total window length in minutes (start→end). */
  totalMinutes: number;
  /** Context for UI / history. */
  source: 'college_early' | 'weekend' | 'profile' | 'manual' | 'none';
  /** Human label e.g. "You have 3h 30m of free time." */
  label: string;
}

export interface FreeTimeInput {
  now?: Date;
  /** College home arrival / left-early time "HH:mm" if status is left_early or bunked. */
  collegeHomeArrivalHm?: string | null;
  collegeStatus?: 'none' | 'attended' | 'left_early' | 'bunked' | string | null;
  /** Next fixed routine time today "HH:mm" (e.g. evening routine 19:30). */
  nextFixedRoutineHm?: string | null;
  /** Weekend wake / day-start "HH:mm" (e.g. 14:00). */
  weekendWakeHm?: string | null;
  /** Weekday spin cutoff override. */
  weekdayCutoffHm?: string;
  /** Weekend hard cutoff (default 22:00). */
  weekendCutoffHm?: string;
  /** Day has an explicit profile that activates spin (rest etc.). */
  profileActivatesSpin?: boolean;
}

/**
 * Compute the current free-time window for Spin.
 * Deterministic — no AI.
 */
export function computeFreeTimeWindow(input: FreeTimeInput = {}): FreeTimeWindow {
  const now = input.now ?? new Date();
  const weekend = isWeekend(now);
  const weekendCutoff = input.weekendCutoffHm ?? WEEKEND_SPIN_CUTOFF_HM;
  const weekdayCutoff = input.weekdayCutoffHm ?? DEFAULT_WEEKDAY_CUTOFF_HM;
  const nextFixed = input.nextFixedRoutineHm ?? DEFAULT_NEXT_FIXED_HM;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // --- Weekend: wake → 22:00 hard cutoff ---
  if (weekend) {
    const wakeHm = input.weekendWakeHm ?? '14:00';
    const wakeMin = hmToMinutes(wakeHm) ?? 14 * 60;
    const endMin = hmToMinutes(weekendCutoff) ?? 22 * 60;
    if (nowMin < wakeMin) {
      return {
        active: false,
        startHm: wakeHm,
        endHm: weekendCutoff,
        remainingMinutes: 0,
        totalMinutes: Math.max(0, endMin - wakeMin),
        source: 'weekend',
        label: 'Weekend day has not started yet',
      };
    }
    if (nowMin >= endMin) {
      return {
        active: false,
        startHm: wakeHm,
        endHm: weekendCutoff,
        remainingMinutes: 0,
        totalMinutes: Math.max(0, endMin - wakeMin),
        source: 'weekend',
        label: 'Weekend Spin window closed (10:00 PM)',
      };
    }
    const remaining = endMin - nowMin;
    return {
      active: remaining >= MIN_FREE_WINDOW_MINUTES,
      startHm: wakeHm,
      endHm: weekendCutoff,
      remainingMinutes: remaining,
      totalMinutes: endMin - wakeMin,
      source: 'weekend',
      label: `You have ${formatMinutes(remaining)} of free time`,
    };
  }

  // --- Weekday: college early leave / bunk → next fixed routine ---
  const status = input.collegeStatus ?? 'none';
  const early =
    status === 'left_early' ||
    status === 'bunked' ||
    (Boolean(input.collegeHomeArrivalHm) && status !== 'attended' && status !== 'none');

  if (early && input.collegeHomeArrivalHm) {
    const startMin = hmToMinutes(input.collegeHomeArrivalHm) ?? nowMin;
    const endMin = hmToMinutes(nextFixed) ?? hmToMinutes(weekdayCutoff) ?? 19 * 60 + 30;
    const windowStart = Math.max(startMin, nowMin);
    if (windowStart >= endMin) {
      return {
        active: false,
        startHm: input.collegeHomeArrivalHm,
        endHm: nextFixed,
        remainingMinutes: 0,
        totalMinutes: Math.max(0, endMin - startMin),
        source: 'college_early',
        label: 'No free time before next routine',
      };
    }
    // Only active once user is at/after home arrival
    if (nowMin < startMin) {
      return {
        active: false,
        startHm: input.collegeHomeArrivalHm,
        endHm: nextFixed,
        remainingMinutes: endMin - startMin,
        totalMinutes: endMin - startMin,
        source: 'college_early',
        label: `Free time starts at ${input.collegeHomeArrivalHm}`,
      };
    }
    const remaining = endMin - nowMin;
    return {
      active: remaining >= MIN_FREE_WINDOW_MINUTES,
      startHm: input.collegeHomeArrivalHm,
      endHm: nextFixed,
      remainingMinutes: remaining,
      totalMinutes: endMin - startMin,
      source: 'college_early',
      label: `You have ${formatMinutes(remaining)} of free time`,
    };
  }

  // Profile-activated spin days (rest etc.) use weekday cutoff from now
  if (input.profileActivatesSpin) {
    const remaining = minutesUntilCutoff(now, weekdayCutoff);
    return {
      active: remaining >= MIN_FREE_WINDOW_MINUTES,
      startHm: minutesToHm(nowMin),
      endHm: weekdayCutoff,
      remainingMinutes: remaining,
      totalMinutes: remaining,
      source: 'profile',
      label:
        remaining > 0
          ? `You have ${formatMinutes(remaining)} of free time`
          : 'Spin window closed',
    };
  }

  return {
    active: false,
    startHm: minutesToHm(nowMin),
    endHm: weekdayCutoff,
    remainingMinutes: 0,
    totalMinutes: 0,
    source: 'none',
    label: 'No free-time window',
  };
}

/**
 * Planned duration for a spun option, clamped to remaining free window.
 */
export function planSpinDuration(
  optionMinutes: number | undefined | null,
  now: Date = new Date(),
  cutoffHm: string = DEFAULT_WEEKDAY_CUTOFF_HM
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

/** Same as planSpinDuration but uses a FreeTimeWindow. */
export function planSpinDurationForWindow(
  optionMinutes: number | undefined | null,
  window: FreeTimeWindow
): { plannedMinutes: number; remainingUntilCutoff: number; capped: boolean } {
  const remaining = window.remainingMinutes;
  if (remaining <= 0) {
    return {
      plannedMinutes: 0,
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
    plannedMinutes: Math.max(5, Math.min(remaining, 60)),
    remainingUntilCutoff: remaining,
    capped: false,
  };
}

/**
 * Filter options that fit the remaining window.
 * If remaining is short, only short activities pass.
 */
export function filterOptionsByBudget<T extends { durationMinutes?: number | null; enabled?: boolean }>(
  options: T[],
  remainingMinutes: number
): T[] {
  const enabled = options.filter((o) => o.enabled !== false);
  if (remainingMinutes <= 0) return [];
  if (remainingMinutes <= SHORT_ACTIVITY_MAX_MINUTES) {
    return enabled.filter((o) => {
      const d = o.durationMinutes;
      if (d == null || d <= 0) return true; // untimed / flexible OK
      return d <= remainingMinutes;
    });
  }
  return enabled.filter((o) => {
    const d = o.durationMinutes;
    if (d == null || d <= 0) return true;
    return d <= remainingMinutes;
  });
}
