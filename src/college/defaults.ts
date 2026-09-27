/**
 * Default college categories and early-leave / home-arrival configuration.
 * Bunk is a College status (not a planned Day Type).
 * Seeded once per install; every row is fully editable afterwards.
 * No historical activity records are invented — only empty categories.
 */

import type { CollegeCategory } from '../data/types';
import { collegeCategoriesRepo } from '../data/repository';
import { isFeatureEnabled, setFeatureEnabled, getSetting, setSetting } from '../data/settings';
import { runSeedOnce } from '../data/seedGuard';

const SEED_FLAG = 'collegeCategoriesSeeded';

export const DEFAULT_BUNK_ARRIVAL_TIMES = ['16:30', '17:00', '17:30', '18:00'];
export const DEFAULT_NORMAL_HOME_ARRIVAL = '19:15';

export const BUNK_ARRIVAL_SETTING_KEY = 'college.bunkArrivalTimes';
export const NORMAL_HOME_SETTING_KEY = 'college.normalHomeArrival';

type SeedCategory = Omit<
  CollegeCategory,
  keyof import('../data/types').BaseEntity | 'order'
>;

const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Attended college', icon: '🎓', enabled: true, systemKey: 'attended' },
  { name: 'Left early / half day', icon: '🚪', enabled: true, systemKey: null },
  { name: 'Bunked college', icon: '🏃', enabled: true, systemKey: 'bunked' },
  { name: 'Skill development', icon: '📚', enabled: true, systemKey: null },
  { name: 'Coding', icon: '💻', enabled: true, systemKey: null },
  { name: 'Games', icon: '🎮', enabled: true, systemKey: null },
  { name: 'Instagram / social', icon: '📱', enabled: true, systemKey: null },
  { name: 'Canteen', icon: '🍜', enabled: true, systemKey: null },
  { name: 'Talking with people', icon: '💬', enabled: true, systemKey: null },
];

/** Seeds default categories once. Never invents historical activity logs. */
export function seedCollegeCategoriesIfNeeded(): Promise<void> {
  return runSeedOnce(SEED_FLAG, async () => {
  if (await isFeatureEnabled(SEED_FLAG, false)) return;

  const existing = await collegeCategoriesRepo.list();
  if (existing.length > 0) {
    await setFeatureEnabled(SEED_FLAG, true);
    return;
  }

  let order = 0;
  for (const cat of DEFAULT_CATEGORIES) {
    await collegeCategoriesRepo.create({ ...cat, order: order++ });
  }

  // Ensure bunk arrival defaults exist in settings
  const times = await getSetting<string[]>(BUNK_ARRIVAL_SETTING_KEY, []);
  if (!times.length) {
    await setSetting(BUNK_ARRIVAL_SETTING_KEY, DEFAULT_BUNK_ARRIVAL_TIMES);
  }
  const normal = await getSetting<string | null>(NORMAL_HOME_SETTING_KEY, null);
  if (!normal) {
    await setSetting(NORMAL_HOME_SETTING_KEY, DEFAULT_NORMAL_HOME_ARRIVAL);
  }

  await setFeatureEnabled(SEED_FLAG, true);
});
}

export async function getBunkArrivalTimes(): Promise<string[]> {
  return getSetting<string[]>(BUNK_ARRIVAL_SETTING_KEY, DEFAULT_BUNK_ARRIVAL_TIMES);
}

export async function setBunkArrivalTimes(times: string[]): Promise<void> {
  await setSetting(BUNK_ARRIVAL_SETTING_KEY, times);
}

export async function getNormalHomeArrival(): Promise<string> {
  return getSetting<string>(NORMAL_HOME_SETTING_KEY, DEFAULT_NORMAL_HOME_ARRIVAL);
}

export async function setNormalHomeArrival(time: string): Promise<void> {
  await setSetting(NORMAL_HOME_SETTING_KEY, time);
}
