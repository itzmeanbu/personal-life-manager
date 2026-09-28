/**
 * Time helpers for the Day Journey: minute math, which part of the day a
 * phase belongs to, and the wake-anchored timeline Home renders.
 * Pure functions only — no storage, no React.
 */
import type { Phase, Routine } from '../data/types';

/** Routines planned at/after this never belong to the Morning phase. */
export const MORNING_END_MIN = 12 * 60;
/** The Evening phase also picks up Hygiene/Meals routines planned at/after this. */
export const EVENING_START_MIN = 17 * 60;
const EVENING_CATEGORIES = ['Hygiene', 'Meals'];

/** A routine counts as "due" this many minutes before its start. */
const DUE_LEAD_MIN = 5;
/** Minutes past start + duration before a routine is shown as overdue. */
const OVERDUE_GRACE_MIN = 15;

export type DayPart = 'morning' | 'evening' | null;

/** "07:05" → 425. Returns null for missing/invalid times. */
export function toMin(hm?: string | null): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** 425 → "07:05" (24h, wraps past midnight). */
export function minToHm(min: number): string {
  const c = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

export function phaseDayPart(phase: Phase): DayPart {
  const name = phase.name.toLowerCase();
  if (phase.categories?.includes('Morning') || /\bmorning\b/.test(name)) return 'morning';
  if (/\bevening\b/.test(name)) return 'evening';
  return null;
}

export function isEveningCategory(category?: string): boolean {
  return !!category && EVENING_CATEGORIES.includes(category);
}

/** "Morning To-Do" → "Morning". A phase is a stretch of the day, not a list. */
export function phaseHeading(name: string): string {
  const cleaned = name.replace(/\s*[-–]?\s*to-?do\s*$/i, '').trim();
  return cleaned || name;
}

export interface TimelineItem {
  routine: Routine;
  /** Time the routine was planned for. */
  plannedMin: number | null;
  /** Planned time after wake-anchoring (same as plannedMin when not shifted). */
  startMin: number | null;
  /** Start time is now (or within the lead window) or already passed. */
  due: boolean;
  /** Well past start + duration and still open. */
  late: boolean;
}

export interface TimelineOptions {
  /** Minutes-from-midnight the person actually woke, or null if not logged. */
  wakeMin: number | null;
  /** Current minutes-from-midnight. */
  nowMin: number;
  /** Shift planned times so the block starts when the person actually woke. */
  anchorToWake: boolean;
  /**
   * Routines used to find the block's planned start. Pass ALL of the phase's
   * routines (including finished ones) so times stay put as items are ticked.
   */
  anchorFrom: Routine[];
}

/**
 * Sorts open routines by start time. In the morning block, planned times are
 * shifted later by however late the person actually woke (never earlier), so
 * "Brush 5:05" becomes "Brush 7:17" for a 7:12 wake-up.
 */
export function buildTimeline(routines: Routine[], opts: TimelineOptions): TimelineItem[] {
  let offset = 0;
  if (opts.anchorToWake && opts.wakeMin != null) {
    const planned = opts.anchorFrom
      .map((r) => toMin(r.time))
      .filter((m): m is number => m != null);
    if (planned.length > 0) offset = Math.max(0, opts.wakeMin - Math.min(...planned));
  }

  const items = routines.map((routine, idx) => {
    const plannedMin = toMin(routine.time);
    const startMin = plannedMin == null ? null : plannedMin + offset;
    const due = startMin != null && startMin <= opts.nowMin + DUE_LEAD_MIN;
    const late =
      startMin != null &&
      opts.nowMin > startMin + (routine.durationMinutes ?? 0) + OVERDUE_GRACE_MIN;
    return { item: { routine, plannedMin, startMin, due, late } as TimelineItem, idx };
  });

  return items
    .sort((a, b) => {
      const am = a.item.startMin;
      const bm = b.item.startMin;
      if (am == null && bm == null) return a.idx - b.idx;
      if (am == null) return 1;
      if (bm == null) return -1;
      return am - bm || a.idx - b.idx;
    })
    .map((x) => x.item);
}
