/**
 * College day-order (1–6) per date.
 * First time you set it → later days auto-advance 1→2→…→6→1
 * until you manually change.
 */
import { getSetting, setSetting } from '../data/settings';

const KEY = 'college.dayOrderByDate.v1';
/** Last explicitly chosen order — used to chain future days. */
const LAST_KEY = 'college.dayOrder.lastChosen.v1';

export type DayOrderMap = Record<string, number>; // iso date → 1..6

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
 * 2) else auto from previous saved day (cycle +1)
 * 3) else null (user must pick once)
 */
export async function getDayOrderForDate(iso: string): Promise<number | null> {
  const map = await getDayOrderMap();
  const n = map[iso];
  if (n >= 1 && n <= 6) return n;

  // Auto-chain from most recent earlier date
  const earlier = Object.keys(map)
    .filter((d) => d < iso)
    .sort();
  if (earlier.length === 0) return null;

  const lastDate = earlier[earlier.length - 1];
  const lastOrder = map[lastDate];
  if (!(lastOrder >= 1 && lastOrder <= 6)) return null;

  // How many calendar days after lastDate?
  const last = new Date(lastDate + 'T12:00:00');
  const cur = new Date(iso + 'T12:00:00');
  const diffDays = Math.round((cur.getTime() - last.getTime()) / 86400000);
  if (diffDays < 1) return lastOrder;

  // Advance one step per day (skip weekends optional later — for now every day)
  let next = lastOrder;
  for (let i = 0; i < diffDays; i++) {
    next = next >= 6 ? 1 : next + 1;
  }

  // Persist so it stays stable for the day
  map[iso] = next;
  await setSetting(KEY, map);
  return next;
}

/** Suggest next day order (cycles 1→2→…→6→1) from last known. */
export async function suggestNextDayOrder(fromIso: string): Promise<number> {
  const map = await getDayOrderMap();
  const dates = Object.keys(map).sort();
  const last = dates.filter((d) => d <= fromIso).pop();
  if (!last) {
    const saved = await getSetting<{ order: number } | null>(LAST_KEY, null);
    if (saved?.order >= 1 && saved.order <= 6) {
      return saved.order >= 6 ? 1 : saved.order + 1;
    }
    return 1;
  }
  const prev = map[last];
  return prev >= 6 ? 1 : prev + 1;
}
