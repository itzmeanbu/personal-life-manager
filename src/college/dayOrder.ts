/**
 * College day-order (1–6) per date.
 *
 * Day order ALWAYS advances with the calendar sequence —
 * leave / bunk does NOT freeze it.
 *
 * Example:
 *   Mon → Order 1
 *   Tue → Order 2
 *   Wed leave → still Order 3
 *   Thu → Order 4
 *
 * Cycle: 1 → 2 → 3 → 4 → 5 → 6 → 1 …
 */

import { getSetting, setSetting } from '../data/settings';

const KEY = 'college.dayOrderByDate.v1';
const LAST_KEY = 'college.dayOrder.lastChosen.v1';

export type DayOrderMap = Record<string, number>;

export async function getDayOrderMap(): Promise<DayOrderMap> {
  return (await getSetting<DayOrderMap | null>(KEY, null)) ?? {};
}

export async function setDayOrderForDate(iso: string, order: number): Promise<void> {
  if (order < 1 || order > 6) throw new Error('day order must be 1–6');
  const map = await getDayOrderMap();
  map[iso] = order;
  await setSetting(KEY, map);
  await setSetting(LAST_KEY, { order, date: iso });
}

/**
 * Resolve day order for a date:
 * 1) exact saved value
 * 2) else +1 per calendar day from most recent earlier date (leave still counts)
 * 3) else null (user must pick once)
 */
export async function getDayOrderForDate(iso: string): Promise<number | null> {
  const map = await getDayOrderMap();
  const n = map[iso];
  if (n >= 1 && n <= 6) return n;

  const earlier = Object.keys(map)
    .filter((d) => d < iso)
    .sort();
  if (earlier.length === 0) {
    const saved = await getSetting<{ order: number; date?: string } | null>(LAST_KEY, null);
    const savedOrder = saved?.order;
    const savedDate = saved?.date;
    if (
      savedOrder != null &&
      savedOrder >= 1 &&
      savedOrder <= 6 &&
      savedDate != null &&
      savedDate < iso
    ) {
      const last = new Date(savedDate + 'T12:00:00');
      const cur = new Date(iso + 'T12:00:00');
      const diffDays = Math.round((cur.getTime() - last.getTime()) / 86400000);
      if (diffDays >= 1) {
        let next = savedOrder;
        for (let i = 0; i < diffDays; i++) {
          next = next >= 6 ? 1 : next + 1;
        }
        map[iso] = next;
        await setSetting(KEY, map);
        return next;
      }
    }
    return null;
  }

  const lastDate = earlier[earlier.length - 1]!;
  const lastOrder = map[lastDate]!;
  if (!(lastOrder >= 1 && lastOrder <= 6)) return null;

  const last = new Date(lastDate + 'T12:00:00');
  const cur = new Date(iso + 'T12:00:00');
  const diffDays = Math.round((cur.getTime() - last.getTime()) / 86400000);
  if (diffDays < 1) return lastOrder;

  let next = lastOrder;
  for (let i = 0; i < diffDays; i++) {
    next = next >= 6 ? 1 : next + 1;
  }

  map[iso] = next;
  await setSetting(KEY, map);
  return next;
}

export async function markDayOrderUsed(iso: string, order: number): Promise<void> {
  if (order < 1 || order > 6) return;
  await setDayOrderForDate(iso, order);
}

export async function suggestNextDayOrder(fromIso: string): Promise<number> {
  const map = await getDayOrderMap();
  const dates = Object.keys(map).sort();
  const last = dates.filter((d) => d <= fromIso).pop();
  if (!last) {
    const saved = await getSetting<{ order: number } | null>(LAST_KEY, null);
    const lastOrder = saved?.order;
    if (lastOrder != null && lastOrder >= 1 && lastOrder <= 6) {
      return lastOrder >= 6 ? 1 : lastOrder + 1;
    }
    return 1;
  }
  const prev = map[last]!;
  return prev >= 6 ? 1 : prev + 1;
}

export async function ensureOrderForPlannedCollege(iso: string): Promise<number> {
  const existing = (await getDayOrderMap())[iso];
  if (existing >= 1 && existing <= 6) return existing;
  const resolved = await getDayOrderForDate(iso);
  if (resolved != null) return resolved;
  const next = await suggestNextDayOrder(iso);
  await setDayOrderForDate(iso, next);
  return next;
}

/** No-op: leave must keep day order. */
export async function clearDayOrderForDate(_iso: string): Promise<void> {}

export async function dayConsumesOrder(_iso: string): Promise<boolean> {
  return true;
}
