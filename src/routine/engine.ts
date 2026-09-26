import type { CompletionRecord, Routine } from '../data/types';

/**
 * The Daily Routine Engine — pure, side-effect-free functions that turn a
 * list of Routine rows + CompletionRecord rows into "what should today look
 * like". Nothing here hard-codes any particular routine, time, or category;
 * every decision reads from the Routine object itself, which is fully
 * editable through the app (see `src/pages/RoutineManager.tsx`).
 *
 * See docs/ROUTINE_ENGINE.md for the design write-up.
 */

export type DerivedStatus = 'done' | 'skipped' | 'missed' | 'partial' | 'upcoming';

export interface AgendaItem {
  routine: Routine;
  status: DerivedStatus;
  completion?: CompletionRecord;
  /** Minutes until (positive) or since (negative) the scheduled time; null if untimed. */
  minutesFromNow: number | null;
}

/** yyyy-mm-dd in local time (not UTC), matching how CompletionRecord.date and Routine.date are stored. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Combines an ISO date with a routine's "HH:mm" time into a real Date, or null if untimed. */
export function scheduledDateTime(isoDate: string, time?: string): Date | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const [y, mo, d] = isoDate.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

/** Whether a routine is scheduled to occur on the given date at all. */
export function isRoutineScheduledOnDate(routine: Routine, date: Date): boolean {
  if (!routine.enabled || routine.archived) return false;

  if (routine.kind === 'one-time') {
    return routine.date === toIsoDate(date);
  }

  const dayIndex = date.getDay(); // 0=Sun..6=Sat
  switch (routine.cadence) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayIndex >= 1 && dayIndex <= 5;
    case 'weekends':
      return dayIndex === 0 || dayIndex === 6;
    case 'weekly':
    case 'custom':
      return routine.activeDays?.includes(dayIndex) ?? false;
    default:
      return false;
  }
}

/** Stable sort: explicit `order` first, then scheduled time, untimed routines last. */
export function sortRoutines(routines: Routine[]): Routine[] {
  return [...routines].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function routinesForDate(routines: Routine[], date: Date): Routine[] {
  return sortRoutines(routines.filter((r) => isRoutineScheduledOnDate(r, date)));
}

/**
 * Derives a routine's status for a date from its completion record (if any),
 * otherwise infers 'missed' (timed, past, untouched) or 'upcoming'.
 * Only "today" can produce 'missed' this way — past days without a record
 * are left as whatever they resolve to (still 'missed' if timed, since a
 * past day with no record genuinely was missed).
 */
export function deriveStatus(
  routine: Routine,
  isoDate: string,
  completion: CompletionRecord | undefined,
  now: Date
): DerivedStatus {
  if (completion) return completion.status;
  const when = scheduledDateTime(isoDate, routine.time);
  if (when && when.getTime() < now.getTime()) return 'missed';
  return 'upcoming';
}

export function buildAgenda(
  routines: Routine[],
  completionRecords: CompletionRecord[],
  date: Date,
  now: Date = new Date()
): AgendaItem[] {
  const isoDate = toIsoDate(date);
  const byRoutineId = new Map(
    completionRecords
      .filter((c) => c.refType === 'routine' && c.date === isoDate && !c.deleted)
      .map((c) => [c.refId, c])
  );

  return routinesForDate(routines, date).map((routine) => {
    const completion = byRoutineId.get(routine.id);
    const status = deriveStatus(routine, isoDate, completion, now);
    const when = scheduledDateTime(isoDate, routine.time);
    const minutesFromNow = when ? Math.round((when.getTime() - now.getTime()) / 60000) : null;
    return { routine, status, completion, minutesFromNow };
  });
}

/** Routines with an active reminder whose reminder moment has arrived but aren't resolved yet. */
export function dueReminders(agenda: AgendaItem[]): AgendaItem[] {
  return agenda.filter((item) => {
    if (!item.routine.reminder.enabled) return false;
    if (item.status !== 'upcoming') return false;
    if (item.minutesFromNow === null) return false;
    return item.minutesFromNow <= item.routine.reminder.offsetMinutes;
  });
}

/** Every distinct category currently in use, for the manager's category picker/filter. */
export function distinctCategories(routines: Routine[]): string[] {
  const set = new Set(routines.filter((r) => !r.deleted).map((r) => r.category).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Next free `order` value so new routines append after everything else by default. */
export function nextOrderValue(routines: Routine[]): number {
  if (routines.length === 0) return 0;
  return Math.max(...routines.map((r) => r.order)) + 1;
}

export const CADENCE_LABELS: Record<Routine['cadence'], string> = {
  daily: 'Every day',
  weekdays: 'Weekdays (Mon–Fri)',
  weekends: 'Weekends (Sat–Sun)',
  weekly: 'Selected day(s) each week',
  custom: 'Custom days',
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const STATUS_LABELS: Record<DerivedStatus, string> = {
  done: 'Done',
  skipped: 'Skipped',
  missed: 'Missed',
  partial: 'Partial',
  upcoming: 'Upcoming',
};
