/**
 * Pure helpers for college activity statistics.
 * Never invents data — only aggregates existing CollegeActivity rows.
 */

import type { CollegeActivity, CollegeCategory } from '../data/types';
import { toIsoDate } from '../routine/engine';

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon?: string;
  total: number;
  enabled: boolean;
}

export type Period = 'day' | 'month' | 'year';

function periodRange(period: Period, ref: Date): { start: string; end: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();

  if (period === 'day') {
    const iso = toIsoDate(ref);
    return { start: iso, end: iso };
  }
  if (period === 'month') {
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }
  // year
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

/**
 * Sum of activity counts per category for the given period.
 * Only includes real logged rows — zeros for categories with no logs.
 */
export function totalsByCategory(
  activities: CollegeActivity[],
  categories: CollegeCategory[],
  period: Period,
  ref: Date = new Date()
): CategoryTotal[] {
  const { start, end } = periodRange(period, ref);
  const active = activities.filter(
    (a) => !a.deleted && a.date >= start && a.date <= end
  );

  const sum = new Map<string, number>();
  for (const a of active) {
    sum.set(a.categoryId, (sum.get(a.categoryId) ?? 0) + (a.count || 1));
  }

  return categories
    .filter((c) => !c.deleted)
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      total: sum.get(c.id) ?? 0,
      enabled: c.enabled,
    }));
}

export function periodLabel(period: Period, ref: Date = new Date()): string {
  if (period === 'day') return toIsoDate(ref);
  if (period === 'month') {
    return ref.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  return String(ref.getFullYear());
}

/** Format "HH:mm" for display as e.g. "4:30 PM". */
export function formatArrivalTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}
