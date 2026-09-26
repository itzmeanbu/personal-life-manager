import type { DevelopmentRecord } from '../data/types';
import { toIsoDate } from '../routine/engine';

function startOfMonth(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function startOfYear(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), 0, 1));
}

export interface DevelopmentStats {
  total: number;
  monthly: number;
  yearly: number;
  byCategory: { category: string; count: number }[];
  records: DevelopmentRecord[];
}

export function computeDevelopmentStats(
  records: DevelopmentRecord[],
  ref: Date = new Date()
): DevelopmentStats {
  const active = records.filter((r) => !r.deleted);
  const monthStart = startOfMonth(ref);
  const yearStart = startOfYear(ref);
  const monthly = active.filter((r) => r.date >= monthStart).length;
  const yearly = active.filter((r) => r.date >= yearStart).length;
  const map = new Map<string, number>();
  for (const r of active) {
    const c = r.category || 'custom';
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  const byCategory = [...map.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  return {
    total: active.length,
    monthly,
    yearly,
    byCategory,
    records: active.sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}
