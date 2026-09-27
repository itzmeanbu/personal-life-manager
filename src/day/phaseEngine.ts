/**
 * Day Journey phase resolution and completion logic.
 */

import {
  phasesRepo,
  dayProgressRepo,
  routinesRepo,
  completionRecordsRepo,
  dayAssignmentsRepo,
  dayProfilesRepo,
} from '../data/repository';
import type { Phase, DayProgress, Routine, CompletionRecord, DayProfile } from '../data/types';
import { toIsoDate, isRoutineScheduledOnDate, sortRoutines } from '../routine/engine';

/** True for free-time / spin style phases that don't need routine rows. */
export function isActionPhase(phase: Phase): boolean {
  if (phase.moduleTags?.includes('spin')) return true;
  const n = phase.name.toLowerCase();
  return n.includes('spin') || n.includes('free time') || n.includes('free-time');
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
  // Action phases (Spin) are never auto-complete from routines — user taps Done
  if (isActionPhase(phase)) return false;

  const items = routinesForPhase(phase, routines, new Date(isoDate + 'T12:00:00'));
  if (items.length === 0) return true;
  return items.every((r) => {
    const rec = completions.find(
      (c) => c.refType === 'routine' && c.refId === r.id && c.date === isoDate && !c.deleted
    );
    return rec && (rec.status === 'done' || rec.status === 'skipped');
  });
}


/**
 * Active DayProfile for a calendar date.
 * Order: explicit DayAssignment → Sunday auto → normal (null).
 * College bunk / left-early is NEVER converted into a Day Type profile.
 * Free-time is derived from CollegeDayStatus + fixed routines by the spin budget engine.
 */
export async function resolveProfileForDate(date: Date): Promise<DayProfile | null> {
  const iso = toIsoDate(date);
  const dayIndex = date.getDay();
  const [profiles, assignments] = await Promise.all([
    dayProfilesRepo.list(),
    dayAssignmentsRepo.list(),
  ]);
  const list = profiles.filter((p) => !p.deleted && p.enabled);
  const assign = assignments.find((a) => a.date === iso && !a.deleted);
  if (assign) {
    return list.find((p) => p.id === assign.profileId) ?? null;
  }
  // Do NOT map college.status === 'bunked' → Bunk profile.
  if (dayIndex === 0) {
    return list.find((p) => p.systemKey === 'sunday') ?? null;
  }
  return null;
}

/** Ordered list of phases that apply on this date. */
export async function resolvePhasesForDate(date: Date): Promise<Phase[]> {
  const all = (await phasesRepo.list()).filter((p) => p.enabled && !p.deleted);
  const dayIndex = date.getDay();
  const sorted = [...all].sort((a, b) => a.order - b.order);
  const profile = await resolveProfileForDate(date);
  const effects = profile?.effects;
  // Legacy bunk profiles (if any still enabled) are treated like rest for module filtering only.
  const isLegacyBunkProfile = profile?.systemKey === 'bunk';
  const isRest =
    profile?.systemKey === 'rest' ||
    profile?.systemKey === 'holiday' ||
    profile?.systemKey === 'stay_out' ||
    profile?.systemKey === 'family_function';
  const forceSpinDay = isLegacyBunkProfile || profile?.systemKey === 'rest';

  const routines = await routinesRepo.list();
  const applicable: Phase[] = [];
  for (const phase of sorted) {
    // Profile can disable whole modules
    if (effects?.disableModuleTags?.length && phase.moduleTags?.length) {
      if (phase.moduleTags.some((t) => effects.disableModuleTags.includes(t))) {
        continue;
      }
    }
    // Rest/holiday/family function: skip college phase structure when appropriate
    if (isRest && !isLegacyBunkProfile && phase.moduleTags?.includes('college')) {
      continue;
    }

    const onActiveDay =
      phase.activeDays.length === 0 || phase.activeDays.includes(dayIndex);
    // Rest-style profiles may surface Spin phase on weekdays
    const forceSpin = forceSpinDay && isActionPhase(phase);

    if (!onActiveDay && !forceSpin) {
      continue;
    }

    const items = routinesForPhase(phase, routines, date);
    if (items.length > 0) {
      applicable.push(phase);
    } else if (isActionPhase(phase) || forceSpin) {
      applicable.push(phase);
    } else if (
      phase === sorted[sorted.length - 1] ||
      phase.name.toLowerCase().includes('sleep')
    ) {
      applicable.push(phase);
    }
  }
  return applicable;
}

export async function getOrCreateDayProgress(date: Date): Promise<DayProgress> {
  const iso = toIsoDate(date);
  const existing = (await dayProgressRepo.list()).find(
    (d) => d.date === iso && !d.deleted
  );

  const phases = await resolvePhasesForDate(date);
  const phaseIds = phases.map((p) => p.id);
  const firstId = phaseIds[0] ?? null;

  if (existing) {
    const needsRebuild = existing.phaseIdsToday.length === 0 && phaseIds.length > 0;
    if (needsRebuild) {
      const updated = await dayProgressRepo.update(existing.id, {
        phaseIdsToday: phaseIds,
        currentPhaseId: firstId,
        completedPhaseIds: [],
      });
      return updated ?? { ...existing, phaseIdsToday: phaseIds, currentPhaseId: firstId, completedPhaseIds: [] };
    }
    return existing;
  }

  const row: Omit<DayProgress, 'id' | 'createdAt' | 'updatedAt' | 'deleted' | 'syncedAt'> = {
    date: iso,
    phaseIdsToday: phaseIds,
    currentPhaseId: firstId,
    completedPhaseIds: [],
  };
  return dayProgressRepo.create(row);
}

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

  if (
    currentId !== progress.currentPhaseId ||
    completed.length !== progress.completedPhaseIds.length
  ) {
    const updated = await dayProgressRepo.update(progress.id, {
      currentPhaseId: currentId,
      completedPhaseIds: completed,
    });
    return updated ?? { ...progress, currentPhaseId: currentId, completedPhaseIds: completed };
  }
  return progress;
}

export async function markPhaseComplete(date: Date, phaseId: string): Promise<DayProgress> {
  const progress = await getOrCreateDayProgress(date);
  const completed = progress.completedPhaseIds.includes(phaseId)
    ? progress.completedPhaseIds
    : [...progress.completedPhaseIds, phaseId];

  const orderedIds = progress.phaseIdsToday;
  const idx = orderedIds.indexOf(phaseId);
  const nextId = idx >= 0 && idx < orderedIds.length - 1 ? orderedIds[idx + 1] : null;

  const updated = await dayProgressRepo.update(progress.id, {
    currentPhaseId: nextId,
    completedPhaseIds: completed,
  });
  return updated ?? { ...progress, currentPhaseId: nextId, completedPhaseIds: completed };
}

export function isDayComplete(progress: DayProgress): boolean {
  return progress.currentPhaseId === null && progress.phaseIdsToday.length > 0;
}

export function phasePosition(
  progress: DayProgress,
  phaseId: string | null
): { current: number; total: number } {
  const total = progress.phaseIdsToday.length;
  if (!phaseId) return { current: total, total };
  const idx = progress.phaseIdsToday.indexOf(phaseId);
  return { current: idx >= 0 ? idx + 1 : 1, total };
}
