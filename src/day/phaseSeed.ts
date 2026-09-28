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
    name: 'Morning',
    icon: '☀️',
    order: 0,
    enabled: true,
    moduleTags: [],
    categories: ['Morning', 'Hygiene', 'Meals'],
    activeDays: [],
  },
  {
    // After leave home → vanishes when bus ends. Music: random from Bus English / Bus Tamil.
    name: 'Bus to College',
    icon: '🚌',
    order: 1,
    enabled: true,
    moduleTags: ['college', 'music'],
    categories: ['Commute'],
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    // 8:50–9:00 outside college buffer before timetable starts.
    name: 'Outside College',
    icon: '🏫',
    order: 2,
    enabled: true,
    moduleTags: ['college'],
    categories: [],
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    name: 'College',
    icon: '🎓',
    order: 3,
    enabled: true,
    moduleTags: ['college'],
    categories: [],
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    // After college / bunk → evening bus + another random song from the 2 playlists.
    name: 'Bus Home',
    icon: '🚌',
    order: 4,
    enabled: true,
    moduleTags: ['college', 'music'],
    categories: ['Commute'],
    activeDays: [1, 2, 3, 4, 5],
  },
  {
    name: 'Workout',
    icon: '🏋️',
    order: 5,
    enabled: true,
    moduleTags: ['workout'],
    categories: [],
    activeDays: [],
  },
  {
    name: 'Spin & Free Time',
    icon: '🎡',
    order: 6,
    enabled: true,
    moduleTags: ['spin'],
    categories: [],
    // Weekends + bunk / extra time at home (4:00–7:30 window uses spin when free).
    activeDays: [0, 6],
  },
  {
    name: 'Evening',
    icon: '🎸',
    order: 7,
    enabled: true,
    moduleTags: ['guitar'],
    categories: ['Music'],
    activeDays: [],
  },
  {
    name: 'Sleep',
    icon: '😴',
    order: 8,
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

/** One-time migration: ensure Spin phase exists even if phases were already seeded. */
export async function ensureSpinPhaseExists(): Promise<void> {
  const all = await phasesRepo.list();
  const hasSpin = all.some(
    (p) => !p.deleted && (p.moduleTags?.includes('spin') || /spin/i.test(p.name))
  );
  if (hasSpin) return;
  await phasesRepo.create({
    name: 'Spin & Free Time',
    icon: '🎡',
    order: 6,
    enabled: true,
    moduleTags: ['spin'],
    categories: [],
    activeDays: [0, 6],
  });
}

/** One-time: add Bus + Outside College phases for existing installs. */
export async function ensureBusPhasesExist(): Promise<void> {
  const all = await phasesRepo.list();
  const names = all.filter((p) => !p.deleted).map((p) => p.name.toLowerCase());
  const hasBusTo = names.some((n) => n.includes('bus to') || n.includes('bus morning'));
  const hasOutside = names.some((n) => n.includes('outside college'));
  const hasBusHome = names.some((n) => n.includes('bus home') || n.includes('bus evening'));
  if (!hasBusTo) {
    await phasesRepo.create({
      name: 'Bus to College',
      icon: '🚌',
      order: 1,
      enabled: true,
      moduleTags: ['college', 'music'],
      categories: ['Commute'],
      activeDays: [1, 2, 3, 4, 5],
    });
  }
  if (!hasOutside) {
    await phasesRepo.create({
      name: 'Outside College',
      icon: '🏫',
      order: 2,
      enabled: true,
      moduleTags: ['college'],
      categories: [],
      activeDays: [1, 2, 3, 4, 5],
    });
  }
  if (!hasBusHome) {
    await phasesRepo.create({
      name: 'Bus Home',
      icon: '🚌',
      order: 4,
      enabled: true,
      moduleTags: ['college', 'music'],
      categories: ['Commute'],
      activeDays: [1, 2, 3, 4, 5],
    });
  }
}
