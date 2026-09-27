/**
 * User lifestyle preferences — drives defaults, nudges, and weekly rules.
 * Everything is editable; nothing is hard-locked.
 */
import { getSetting, setSetting } from '../data/settings';

const KEY = 'lifestyle.config';

export type WorkoutDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface LifestyleConfig {
  wizardDone: boolean;
  wakeHm: string;
  bathHm: string;
  collegeWeekends: boolean;
  workoutRestDay: WorkoutDayIndex;
  guitarMinutes: number;
  freeTimeEndHm: string;
  sundayEatFromHm: string;
  plugSwitchNudge: boolean;
  phoneChargeNudge: boolean;
  encouragementOn: boolean;
}

export const DEFAULT_LIFESTYLE: LifestyleConfig = {
  wizardDone: false,
  wakeHm: '07:00',
  bathHm: '21:30',
  collegeWeekends: true,
  workoutRestDay: 0,
  guitarMinutes: 60,
  freeTimeEndHm: '21:00',
  sundayEatFromHm: '07:30',
  plugSwitchNudge: true,
  phoneChargeNudge: true,
  encouragementOn: true,
};

export async function getLifestyle(): Promise<LifestyleConfig> {
  const s = await getSetting<Partial<LifestyleConfig> | null>(KEY, null);
  return { ...DEFAULT_LIFESTYLE, ...(s ?? {}) };
}

export async function setLifestyle(patch: Partial<LifestyleConfig>): Promise<LifestyleConfig> {
  const cur = await getLifestyle();
  const next = { ...cur, ...patch };
  await setSetting(KEY, next);
  return next;
}

export function workoutDays(rest: WorkoutDayIndex): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== rest);
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
