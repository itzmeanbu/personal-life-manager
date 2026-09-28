/**
 * Day types — friendly names, ranges (Deep Work / Coimbatore Stay),
 * Sunday-default toggle, and assignment of a type to a date.
 * All data lives in Dexie (dayProfiles, dayAssignments, appSettings).
 */
import { dayProfilesRepo, dayAssignmentsRepo } from '../data/repository';
import { getSetting, setSetting } from '../data/settings';
import type { DayProfile } from '../data/types';
import { emptyEffects } from './effects';
import { generateId } from '../data/repository';

export type DayTypeKey =
  | 'normal'
  | 'bunk'
  | 'event'
  | 'rest'
  | 'deep_work'
  | 'coimbatore_stay';

export interface DayTypeInfo {
  key: DayTypeKey;
  name: string;
  icon: string;
  /** Old default names that may be replaced by the new friendly name. */
  legacyNames: string[];
}

export const DAY_TYPES: DayTypeInfo[] = [
  { key: 'normal', name: 'Campus Day', icon: '🎓', legacyNames: ['Normal College Day'] },
  { key: 'bunk', name: 'Early Exit Day', icon: '🏃', legacyNames: ['Bunk Day'] },
  { key: 'event', name: 'Campus Event Day', icon: '🎉', legacyNames: ['Event Day'] },
  { key: 'rest', name: 'Recharge Day', icon: '🛋️', legacyNames: ['Rest Day'] },
  { key: 'deep_work', name: 'Deep Work Day', icon: '💻', legacyNames: [] },
  { key: 'coimbatore_stay', name: 'Coimbatore Stay', icon: '🌆', legacyNames: [] },
];

/* ------------------------------ ranges ------------------------------ */

export interface DateRange {
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd (inclusive)
}

const RANGE_KEYS = {
  deep_work: 'day.deepWork.ranges.v1',
  coimbatore_stay: 'day.coimbatoreStay.ranges.v1',
} as const;

export async function getRanges(key: 'deep_work' | 'coimbatore_stay'): Promise<DateRange[]> {
  return (await getSetting<DateRange[] | null>(RANGE_KEYS[key], null)) ?? [];
}

export async function addRange(
  key: 'deep_work' | 'coimbatore_stay',
  start: string,
  days: number
): Promise<void> {
  const n = Math.max(1, Math.round(days));
  const end = addDaysIso(start, n - 1);
  const list = await getRanges(key);
  // Remove overlapping starts so re-picking replaces the old range.
  const kept = list.filter((r) => r.start !== start);
  await setSetting(RANGE_KEYS[key], [...kept, { start, end }]);
}

export async function endRangeOn(
  key: 'deep_work' | 'coimbatore_stay',
  lastDay: string
): Promise<void> {
  const list = await getRanges(key);
  const next = list
    .map((r) => (r.start <= lastDay && r.end > lastDay ? { ...r, end: lastDay } : r))
    .filter((r) => r.end >= r.start);
  await setSetting(RANGE_KEYS[key], next);
}

export async function clearRangesCovering(
  key: 'deep_work' | 'coimbatore_stay',
  iso: string
): Promise<void> {
  const list = await getRanges(key);
  await setSetting(
    RANGE_KEYS[key],
    list.filter((r) => !(r.start <= iso && iso <= r.end))
  );
}

export function rangeCovers(ranges: DateRange[], iso: string): boolean {
  return ranges.some((r) => r.start <= iso && iso <= r.end);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/* ------------------------------ sunday default ------------------------------ */

const SUNDAY_KEY = 'day.sundayDefault.v1';

/** Default OFF: Sunday is never assumed to be a rest/holiday day. */
export async function getSundayDefault(): Promise<boolean> {
  return getSetting<boolean>(SUNDAY_KEY, false);
}
export async function setSundayDefault(on: boolean): Promise<void> {
  await setSetting(SUNDAY_KEY, on);
}

/* ------------------------------ seeding / renaming ------------------------------ */

const ENSURE_FLAG = 'day.dayTypes.ensured.v1';

/**
 * Idempotent: rename legacy display names (only if untouched),
 * and add Deep Work Day + Coimbatore Stay profiles if missing.
 * Safe to call on every app start.
 */
export async function ensureDayTypeProfiles(): Promise<void> {
  const profiles = (await dayProfilesRepo.list()).filter((p) => !p.deleted);

  for (const info of DAY_TYPES) {
    const existing = profiles.find((p) => p.systemKey === info.key);
    if (existing) {
      if (info.legacyNames.includes(existing.name)) {
        await dayProfilesRepo.update(existing.id, { name: info.name, icon: info.icon });
      }
      continue;
    }
    if (info.key === 'deep_work' || info.key === 'coimbatore_stay') {
      const order = profiles.reduce((m, p) => Math.max(m, p.order), -1) + 1;
      await dayProfilesRepo.create(buildProfile(info, order));
    }
  }
  await setSetting(ENSURE_FLAG, true);
}

function buildProfile(info: DayTypeInfo, order: number): Omit<DayProfile, 'id' | 'createdAt' | 'updatedAt' | 'deleted' | 'syncedAt'> {
  const fx = emptyEffects();
  if (info.key === 'deep_work') {
    return {
      name: info.name,
      icon: info.icon,
      description: 'Coding focus. Overrides other routines, can run for days or weeks.',
      order,
      enabled: true,
      systemKey: 'deep_work',
      effects: {
        ...fx,
        replaceBaseRoutines: false,
        bannerMessage: 'Deep Work Day: coding first, normal routines paused',
        disableModuleTags: ['workout', 'guitar', 'spin', 'entertainment'],
        focusModules: ['today', 'learning', 'development', 'money', 'music'],
        checklist: [
          { id: generateId(), title: 'Pick today\'s coding goal' },
          { id: generateId(), title: 'Focus block 1' },
          { id: generateId(), title: 'Focus block 2' },
          { id: generateId(), title: 'Review + commit' },
        ],
      },
    };
  }
  return {
    name: info.name,
    icon: info.icon,
    description: 'College then stay in Coimbatore. Planned or sudden, can last many days.',
    order,
    enabled: true,
    systemKey: 'coimbatore_stay',
    effects: {
      ...fx,
      replaceBaseRoutines: false,
      bannerMessage: 'Coimbatore Stay: wake when you want, drink water, eat on time',
      disableModuleTags: ['workout', 'guitar'],
      focusModules: ['today', 'college', 'social', 'money', 'bike', 'music'],
      travelPlan: 'Check bus back and friends room timing.',
      foodPlan: 'Eat after waking. Set eating reminders.',
      checklist: [
        { id: generateId(), title: 'Water after waking' },
        { id: generateId(), title: 'Brush, wash, bath' },
        { id: generateId(), title: 'Skin and hair treatment' },
        { id: generateId(), title: 'Eat something' },
      ],
    },
  };
}

/* ------------------------------ assign ------------------------------ */

/** Find the profile for a type key. */
export async function profileForKey(key: DayTypeKey): Promise<DayProfile | undefined> {
  const list = (await dayProfilesRepo.list()).filter((p) => !p.deleted && p.enabled);
  return list.find((p) => p.systemKey === key);
}

/**
 * Assign a day type to a date. For Deep Work and Coimbatore Stay pass `days`
 * (how many days in a row, starting on `iso`).
 */
export async function assignDayType(
  iso: string,
  key: DayTypeKey,
  days = 1
): Promise<void> {
  await ensureDayTypeProfiles();

  // Clear any range that covered this date so the new pick wins cleanly.
  await clearRangesCovering('deep_work', iso);
  await clearRangesCovering('coimbatore_stay', iso);

  if (key === 'deep_work' || key === 'coimbatore_stay') {
    await addRange(key, iso, days);
  }

  const profile = await profileForKey(key);
  const assignments = (await dayAssignmentsRepo.list()).filter((a) => a.date === iso && !a.deleted);

  // 'normal' means: no special assignment (plain Campus Day).
  if (key === 'normal') {
    for (const a of assignments) await dayAssignmentsRepo.remove(a.id);
    return;
  }
  if (!profile) return;

  if (assignments.length > 0) {
    const [first, ...rest] = assignments;
    await dayAssignmentsRepo.update(first.id, { profileId: profile.id });
    for (const a of rest) await dayAssignmentsRepo.remove(a.id);
  } else {
    await dayAssignmentsRepo.create({ date: iso, profileId: profile.id, checklistDone: [] });
  }
}
