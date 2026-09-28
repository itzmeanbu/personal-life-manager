import type { Phase } from '../data/types';
import { phasesRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'dayJourneyPhasesSeeded';

/**
 * Default walk-through-the-day order.
 * - Morning / College / Workout / Evening / Sleep: every day (items gate whether shown)
 * - Spin & Free Time: weekends by default (Sat=6, Sun=0); user can change activeDays
 *
 * activeDays: [] = every day. [0,6] = Sun+Sat only.
 */
type SeedPhase = Omit<Phase, keyof import('../data/types').BaseEntity>;

const DEFAULT_PHASES: SeedPhase[] = [
  {
    name: 'Morning To-Do',
    icon: '☀️',
    order: 0,
    enabled: true,
    moduleTags: ['morning'],
    categories: [],
    activeDays: [],
  },
  {
    name: 'College',
    icon: '🎓',
    order: 1,
    enabled: true,
    moduleTags: ['college'],
    categories: [],
    activeDays: [],
  },
  {
    name: 'Workout',
    icon: '🏋️',
    order: 3,
    enabled: true,
    moduleTags: ['workout'],
    categories: [],
    activeDays: [],
  },
  {
    name: 'Spin & Free Time',
    icon: '🎡',
    order: 2,
    enabled: true,
    moduleTags: ['spin'],
    categories: [],
    // Weekend by default — user can add weekdays in Weekly Schedule / phase edit later
    activeDays: [0, 6],
  },
  {
    name: 'Evening',
    icon: '🎸',
    order: 4,
    enabled: true,
    moduleTags: ['guitar', 'night'],
    categories: ['Music'],
    // every day — guitar especially useful Sunday night after spin
    activeDays: [],
  },
  {
    name: 'Sleep',
    icon: '😴',
    order: 5,
    enabled: true,
    moduleTags: [],
    categories: ['Rest'],
    activeDays: [],
  },
];

export function seedDefaultPhasesIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
    if (await isFeatureEnabled(SEED_FLAG, false)) return;

    const existing = await phasesRepo.list();
    if (existing.length === 0) {
      for (const phase of DEFAULT_PHASES) {
        await phasesRepo.create(phase);
      }
    }
    await setFeatureEnabled(SEED_FLAG, true);
  });
}

/** One-time migration: align the existing phase templates with the phase-by-phase flow. */
export async function ensurePhaseFlowV2(): Promise<void> {
  const all = await phasesRepo.list();
  const morning = all.find((p) => !p.deleted && /morning/i.test(p.name));
  if (morning) await phasesRepo.update(morning.id, { moduleTags: ['morning'], categories: [] });
  const evening = all.find((p) => !p.deleted && /evening/i.test(p.name));
  if (evening) await phasesRepo.update(evening.id, { moduleTags: ['guitar', 'night'], categories: ['Music'] });
}

/** One-time migration: ensure Spin phase exists even if phases were already seeded. */
export async function ensureSpinPhaseExists(): Promise<void> {
  const all = await phasesRepo.list();
  const spin = all.find((p) => !p.deleted && (p.moduleTags?.includes('spin') || /spin/i.test(p.name)));
  const workout = all.find((p) => !p.deleted && p.moduleTags?.includes('workout'));
  if (spin && workout && spin.order > workout.order) {
    await phasesRepo.update(spin.id, { order: workout.order });
    await phasesRepo.update(workout.id, { order: spin.order });
  }
  const hasSpin = all.some(
    (p) => !p.deleted && (p.moduleTags?.includes('spin') || /spin/i.test(p.name))
  );
  if (hasSpin) return;
  await phasesRepo.create({
    name: 'Spin & Free Time',
    icon: '🎡',
    order: 2,
    enabled: true,
    moduleTags: ['spin'],
    categories: [],
    activeDays: [0, 6],
  });
}
