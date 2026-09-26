/**
 * Seeds category shells only — no specific shows/movies hard-coded.
 */

import type { EntertainmentCategory } from '../data/types';
import { entertainmentCategoriesRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'entertainmentCategoriesSeeded';

type SeedCat = Omit<EntertainmentCategory, keyof import('../data/types').BaseEntity | 'order'>;

const DEFAULTS: SeedCat[] = [
  {
    name: 'K-drama',
    icon: '📺',
    enabled: true,
    systemKey: 'kdrama',
    defaultBingeMinutes: 240, // 4 hours — configurable per category
    notes: 'Binge-oriented. Default session length is editable.',
  },
  {
    name: 'Anime',
    icon: '🎌',
    enabled: true,
    systemKey: 'anime',
    defaultBingeMinutes: 72, // ~3 episodes placeholder; user can change
  },
  {
    name: 'TV',
    icon: '📡',
    enabled: true,
    systemKey: 'tv',
    defaultBingeMinutes: 60,
  },
  {
    name: 'Movies',
    icon: '🎬',
    enabled: true,
    systemKey: 'movies',
    defaultBingeMinutes: 120,
  },
];

export function seedEntertainmentCategoriesIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;
  const existing = await entertainmentCategoriesRepo.list();
  if (existing.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }
  let order = 0;
  for (const c of DEFAULTS) {
    await entertainmentCategoriesRepo.create({ ...c, order: order++ });
  }
  await setFeatureEnabled(SEED_FLAG, true);
});
}
