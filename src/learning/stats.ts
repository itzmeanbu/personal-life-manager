import type { LearningSession } from '../data/types';
import { toIsoDate } from '../routine/engine';

function weekStart(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  return toIsoDate(x);
}

function monthStart(d: Date): string {
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function computeLearningTotals(sessions: LearningSession[], ref = new Date()) {
  const active = sessions.filter((s) => !s.deleted && s.status !== 'skipped');
  const today = toIsoDate(ref);
  const week = weekStart(ref);
  const month = monthStart(ref);
  let todayMin = 0;
  let weekMin = 0;
  let monthMin = 0;
  let lifeMin = 0;
  for (const s of active) {
    const m = s.durationMinutes || 0;
    lifeMin += m;
    if (s.date === today) todayMin += m;
    if (s.date >= week) weekMin += m;
    if (s.date >= month) monthMin += m;
  }
  return {
    todayMin,
    weekMin,
    monthMin,
    lifeMin,
    completed: sessions.filter((s) => !s.deleted && s.status === 'completed').length,
    skipped: sessions.filter((s) => !s.deleted && s.status === 'skipped').length,
    history: sessions.filter((s) => !s.deleted).sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
