/**
 * Day Journey phase resolution and completion logic.
 *
 * - Resolves which phases apply to a given date (based on Phase.activeDays
 *   and whether the phase has any applicable items that day).
 * - Builds / resumes DayProgress for the date.
 * - Decides when a phase is complete (every enabled routine belonging to
 *   it for that date is marked done/skipped).
 * - Advances currentPhaseId automatically; skips empty phases; ends on
 *   the last phase with "All done".
 */

import {
  phasesRepo,
  dayProgressRepo,
  routinesRepo,
  completionRecordsRepo,
} from '../data/repository';
import type { Phase, DayProgress, Routine, CompletionRecord } from '../data/types';
import { toIsoDate, isRoutineScheduledOnDate, sortRoutines } from '../routine/engine';
import { generateId } from '../data/repository';

function nowIso(): string {
  return new Date().toISOString();
}

/** Routines that belong to a phase on a given date. */
export function routinesForPhase(
  phase: Phase,
  allRoutines: Routine[],
  date: Date
): Routine[] {
  const scheduled = allRoutines.filter((r) => isRoutineScheduledOnDate(r, date));
  return sortRoutines(
    scheduled.filter((r) => {
      if (phase.moduleTags.length > 0 && r.moduleTag) {
        if (phase.moduleTags.includes(r.moduleTag)) return true;
      }
      if (phase.categories.length > 0 && r.category) {
        if (phase.categories.includes(r.category)) return true;
      }
      // If phase has neither tags nor categories, match nothing (shouldn't happen for defaults)
      return false;
    })
  );
}

/** Whether every item in the phase for today is done or skipped. */
export function isPhaseComplete(
  phase: Phase,
  routines: Routine[],
  completions: CompletionRecord[],
  isoDate: string
): boolean {
  const items = routinesForPhase(phase, routines, new Date(isoDate + 'T12:00:00'));
  if (items.length === 0) return true; // empty => treat as complete so we skip
  return items.every((r) => {
    const rec = completions.find(
      (c) => c.refType === 'routine' && c.refId === r.id && c.date === isoDate && !c.deleted
    );
    return rec && (rec.status === 'done' || rec.status === 'skipped');
  });
}

/** Ordered list of phases that apply on this date (enabled + activeDays match + has items or is last). */
export async function resolvePhasesForDate(date: Date): Promise<Phase[]> {
  const all = (await phasesRepo.list()).filter((p) => p.enabled && !p.deleted);
  const dayIndex = date.getDay();
  const sorted = [...all].sort((a, b) => a.order - b.order);

  const routines = await routinesRepo.list();
  const applicable: Phase[] = [];
  for (const phase of sorted) {
    if (phase.activeDays.length > 0 && !phase.activeDays.includes(dayIndex)) {
      continue;
    }
    const items = routinesForPhase(phase, routines, date);
    // Keep phases that have items; also keep the final "Sleep" style phase even if empty
    // so the day can still end cleanly. For empty intermediate phases we skip them.
    if (items.length > 0) {
      applicable.push(phase);
    } else if (phase === sorted[sorted.length - 1] || phase.name.toLowerCase().includes('sleep')) {
      // Keep terminal phase even if empty so "All done" can still be reached.
      applicable.push(phase);
    }
  }
  return applicable;
}

/**
 * Get or create DayProgress for the given date.
 * On first access for a date: resolves phaseIdsToday, sets current to first.
 * On later access same day: returns existing (resume).
 * Different date: new row.
 */
export async function getOrCreateDayProgress(date: Date): Promise<DayProgress> {
  const iso = toIsoDate(date);
  const existing = (await dayProgressRepo.list()).find(
    (d) => d.date === iso && !d.deleted
  );
  if (existing) return existing;

  const phases = await resolvePhasesForDate(date);
  const phaseIds = phases.map((p) => p.id);
  const firstId = phaseIds[0] ?? null;

  const row: Omit<DayProgress, 'id' | 'createdAt' | 'updatedAt' | 'deleted' | 'syncedAt'> = {
    date: iso,
    phaseIdsToday: phaseIds,
    currentPhaseId: firstId,
    completedPhaseIds: [],
  };
  return dayProgressRepo.create(row);
}

/**
 * Re-evaluate completion of the current phase and advance if needed.
 * Call after any routine completion change for the date.
 * Returns the (possibly updated) DayProgress.
 */
export async function evaluateAndAdvance(date: Date): Promise<DayProgress> {
  const progress = await getOrCreateDayProgress(date);
  const iso = progress.date;
  const allPhases = await phasesRepo.list();
  const phaseMap = new Map(allPhases.map((p) => [p.id, p]));
  const routines = await routinesRepo.list();
  const completions = (await completionRecordsRepo.list()).filter(
    (c) => c.date === iso && !c.deleted
  );

  let currentId = progress.currentPhaseId;
  let completed = [...progress.completedPhaseIds];
  const orderedIds = progress.phaseIdsToday;

  // Advance through any already-complete phases
  while (currentId) {
    const phase = phaseMap.get(currentId);
    if (!phase) break;
    if (!isPhaseComplete(phase, routines, completions, iso)) break;

    if (!completed.includes(currentId)) {
      completed.push(currentId);
    }
    const idx = orderedIds.indexOf(currentId);
    const nextId = idx >= 0 && idx < orderedIds.length - 1 ? orderedIds[idx + 1] : null;
    currentId = nextId;
  }

  // If we moved, persist
  if (
    currentId !== progress.currentPhaseId ||
    completed.length !== progress.completedPhaseIds.length
  ) {
    return dayProgressRepo.update(progress.id, {
      currentPhaseId: currentId,
      completedPhaseIds: completed,
    });
  }
  return progress;
}

/** Mark a specific phase complete (used when user finishes last item). */
export async function markPhaseComplete(date: Date, phaseId: string): Promise<DayProgress> {
  const progress = await getOrCreateDayProgress(date);
  const completed = progress.completedPhaseIds.includes(phaseId)
    ? progress.completedPhaseIds
    : [...progress.completedPhaseIds, phaseId];

  const orderedIds = progress.phaseIdsToday;
  const idx = orderedIds.indexOf(phaseId);
  const nextId = idx >= 0 && idx < orderedIds.length - 1 ? orderedIds[idx + 1] : null;

  return dayProgressRepo.update(progress.id, {
    currentPhaseId: nextId,
    completedPhaseIds: completed,
  });
}

/** True when every phase for the day is done (currentPhaseId is null). */
export function isDayComplete(progress: DayProgress): boolean {
  return progress.currentPhaseId === null && progress.phaseIdsToday.length > 0;
}

/** Human index for UI: "Phase 2 of 5". 1-based among phaseIdsToday. */
export function phasePosition(
  progress: DayProgress,
  phaseId: string | null
): { current: number; total: number } {
  const total = progress.phaseIdsToday.length;
  if (!phaseId) return { current: total, total };
  const idx = progress.phaseIdsToday.indexOf(phaseId);
  return { current: idx >= 0 ? idx + 1 : 1, total };
}
