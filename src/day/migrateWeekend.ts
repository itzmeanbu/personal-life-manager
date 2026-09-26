/**
 * Existing installs still have weekday-only hygiene + empty DayProgress.
 * This migrates routines to daily, ensures Spin phase, rebuilds today.
 */
import { routinesRepo, dayProgressRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { ensureSpinPhaseExists } from './phaseSeed';
import { resolvePhasesForDate } from './phaseEngine';
import { toIsoDate } from '../routine/engine';

const MIGRATE_FLAG = 'weekendJourneyMigrated_v2';

const DAILY_TITLES = new Set([
  'wake up',
  'brush',
  'face wash',
  'hair serum',
  'breakfast',
  'sleep',
  'guitar practice',
]);

export async function migrateWeekendJourney(): Promise<void> {
  await ensureSpinPhaseExists();

  if (!(await isFeatureEnabled(MIGRATE_FLAG, false))) {
    const routines = await routinesRepo.list();
    for (const r of routines) {
      if (r.deleted) continue;
      const t = r.title.trim().toLowerCase();
      if (!DAILY_TITLES.has(t)) continue;
      await routinesRepo.update(r.id, {
        cadence: 'daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      });
    }
    await setFeatureEnabled(MIGRATE_FLAG, true);
  }

  await rebuildTodayIfEmpty();
}

export async function rebuildTodayIfEmpty(date: Date = new Date()): Promise<void> {
  const iso = toIsoDate(date);
  const existing = (await dayProgressRepo.list()).find((d) => d.date === iso && !d.deleted);
  const phases = await resolvePhasesForDate(date);
  if (phases.length === 0) return;

  const spinMissing =
    existing &&
    phases.some(
      (p) =>
        (p.moduleTags?.includes('spin') || /spin/i.test(p.name)) &&
        !existing.phaseIdsToday.includes(p.id)
    );

  if (!existing) {
    await dayProgressRepo.create({
      date: iso,
      phaseIdsToday: phases.map((p) => p.id),
      currentPhaseId: phases[0]?.id ?? null,
      completedPhaseIds: [],
    });
    return;
  }

  if (existing.phaseIdsToday.length === 0 || spinMissing) {
    await dayProgressRepo.update(existing.id, {
      phaseIdsToday: phases.map((p) => p.id),
      currentPhaseId: phases[0]?.id ?? null,
      completedPhaseIds: [],
    });
  }
}

export async function forceRebuildToday(date: Date = new Date()): Promise<void> {
  await ensureSpinPhaseExists();
  const iso = toIsoDate(date);
  const phases = await resolvePhasesForDate(date);
  const existing = (await dayProgressRepo.list()).find((d) => d.date === iso && !d.deleted);
  const payload = {
    phaseIdsToday: phases.map((p) => p.id),
    currentPhaseId: phases[0]?.id ?? null,
    completedPhaseIds: [] as string[],
  };
  if (existing) await dayProgressRepo.update(existing.id, payload);
  else await dayProgressRepo.create({ date: iso, ...payload });
}
