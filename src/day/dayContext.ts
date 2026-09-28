/**
 * Small helpers to know what kind of day a date is.
 * Used by the Wake Coach, travel card and notification scheduler.
 */
import { collegeDayStatusesRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import { resolveProfileForDate } from './phaseEngine';

async function collegeStatus(date: Date): Promise<string | null> {
  const iso = toIsoDate(date);
  const rows = await collegeDayStatusesRepo.list();
  return rows.find((d) => d.date === iso && !d.deleted)?.status ?? null;
}

/** Campus Day or Early Exit Day: bus + wake coach apply. */
export async function isCoachDay(date: Date): Promise<boolean> {
  const key = (await resolveProfileForDate(date))?.systemKey ?? null;
  if (key === 'bunk' || key === 'normal') return true;
  if (key) return false;
  const st = await collegeStatus(date);
  if (st === 'attended' || st === 'bunked') return true;
  const dow = date.getDay();
  return dow >= 1 && dow <= 5;
}

/** Days with travel + spending prompts (Campus, Early Exit, Campus Event). */
export async function isCollegeLikeDay(date: Date): Promise<boolean> {
  const key = (await resolveProfileForDate(date))?.systemKey ?? null;
  if (key === 'event') return true;
  return isCoachDay(date);
}
