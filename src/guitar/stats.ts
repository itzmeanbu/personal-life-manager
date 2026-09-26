import type { GuitarSession } from '../data/types';
import { toIsoDate } from '../routine/engine';

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export interface GuitarTotals {
  todayMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  lifetimeMinutes: number;
  completedCount: number;
  skippedCount: number;
  sessions: GuitarSession[];
}

export function computeGuitarTotals(
  sessions: GuitarSession[],
  ref: Date = new Date()
): GuitarTotals {
  const active = sessions.filter((s) => !s.deleted);
  const today = toIsoDate(ref);
  const weekStart = toIsoDate(startOfWeek(ref));
  const monthStart = toIsoDate(startOfMonth(ref));

  let todayMinutes = 0;
  let weekMinutes = 0;
  let monthMinutes = 0;
  let lifetimeMinutes = 0;
  let completedCount = 0;
  let skippedCount = 0;

  for (const s of active) {
    if (s.status === 'skipped') {
      skippedCount++;
      continue;
    }
    const mins = s.durationMinutes || 0;
    lifetimeMinutes += mins;
    if (s.status === 'completed' || s.status === 'partial') completedCount++;
    if (s.date === today) todayMinutes += mins;
    if (s.date >= weekStart) weekMinutes += mins;
    if (s.date >= monthStart) monthMinutes += mins;
  }

  return {
    todayMinutes,
    weekMinutes,
    monthMinutes,
    lifetimeMinutes,
    completedCount,
    skippedCount,
    sessions: active.sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
