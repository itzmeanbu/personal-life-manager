import type { Phase } from '../data/types';
import { phasesRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'dayJourneyPhasesSeeded';

/**
 * Default walk-through-the-day order. Every field here is a normal Phase
 * row the user can rename, reorder, retarget (change which moduleTags or
 * categories feed it), restrict to certain days, disable, or delete —
 * nothing downstream special-cases these rows by name. Deleting all of
 * them leaves the Day Journey with nothing to show, which is a valid
 * (if empty) state, not an error.
 */
type SeedPhase = Omit<Phase, keyof import('../data/types').BaseEntity>;

const DEFAULT_PHASES: SeedPhase[] = [
  {
    name: 'Morning To-Do',
    icon: '☀️',
    order: 0,
    enabled: true,
    moduleTags: [],
    categories: ['Morning', 'Hygiene', 'Meals'],
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
    order: 2,
    enabled: true,
    moduleTags: ['workout'],
    categories: [],
    activeDays: [],
  },
  {
    name: 'Evening',
    icon: '🎸',
    order: 3,
    enabled: true,
    moduleTags: ['guitar'],
    categories: ['Music'],
    activeDays: [],
  },
  {
    name: 'Sleep',
    icon: '😴',
    order: 4,
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
