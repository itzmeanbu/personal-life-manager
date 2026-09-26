import type { SleepRecord } from '../data/types';
import type { SleepConfig } from './settings';
import { toIsoDate } from '../routine/engine';

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Bedtimes after midnight map to 24h+ for average math (e.g. 00:30 → 1470). */
export function bedtimeToSortMinutes(hm: string): number {
  const mins = hmToMinutes(hm);
  // Treat 00:00–04:59 as "after midnight" continuation of the evening
  if (mins < 5 * 60) return mins + 24 * 60;
  return mins;
}

export function minutesToHm(total: number): string {
  let m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function classifyAdherence(
  bedtimeHm: string,
  config: SleepConfig
): 'on_time' | 'late' | 'early' {
  const bed = bedtimeToSortMinutes(bedtimeHm);
  const target = bedtimeToSortMinutes(config.targetBedtime);
  const tol = config.toleranceMinutes;
  if (bed <= target + tol && bed >= target - tol) return 'on_time';
  if (bed > target + tol) return 'late';
  return 'early';
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export interface SleepStats {
  averageBedtimeHm: string | null;
  onTimeDays: number;
  lateDays: number;
  earlyDays: number;
  loggedNights: number;
  /** on_time / logged — not a hard-coded late-night percentage target. */
  adherenceRate: number | null;
  weekRecords: SleepRecord[];
  monthRecords: SleepRecord[];
  allRecords: SleepRecord[];
}

export function computeSleepStats(
  records: SleepRecord[],
  config: SleepConfig,
  ref: Date = new Date()
): SleepStats {
  const active = records.filter((r) => !r.deleted && r.bedtimeHm);
  const weekStart = toIsoDate(startOfWeek(ref));
  const monthStart = toIsoDate(startOfMonth(ref));

  let onTimeDays = 0;
  let lateDays = 0;
  let earlyDays = 0;
  const bedMinutes: number[] = [];

  for (const r of active) {
    const adh = r.adherence ?? classifyAdherence(r.bedtimeHm!, config);
    if (adh === 'on_time') onTimeDays++;
    else if (adh === 'late') lateDays++;
    else if (adh === 'early') earlyDays++;
    bedMinutes.push(bedtimeToSortMinutes(r.bedtimeHm!));
  }

  const loggedNights = active.length;
  const averageBedtimeHm =
    bedMinutes.length === 0
      ? null
      : minutesToHm(Math.round(bedMinutes.reduce((a, b) => a + b, 0) / bedMinutes.length));

  const adherenceRate =
    loggedNights === 0 ? null : onTimeDays / loggedNights;

  const sorted = [...active].sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    averageBedtimeHm,
    onTimeDays,
    lateDays,
    earlyDays,
    loggedNights,
    adherenceRate,
    weekRecords: sorted.filter((r) => r.date >= weekStart),
    monthRecords: sorted.filter((r) => r.date >= monthStart),
    allRecords: sorted,
  };
}

export function formatAdherence(a?: string): string {
  switch (a) {
    case 'on_time':
      return 'On time';
    case 'late':
      return 'Late';
    case 'early':
      return 'Early';
    default:
      return '—';
  }
}
