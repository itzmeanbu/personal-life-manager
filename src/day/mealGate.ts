/**
 * Meal gate — Sunday ~07:30 (or chosen time); other days after morning block.
 * Stores answers per local date.
 */
import { getSetting, setSetting } from '../data/settings';

const KEY = 'day.mealGate';

export interface MealGateState {
  date: string;
  ate: boolean | null;
  eatAtHm?: string;
  freeTimeAfterIso?: string;
  remindedAt?: string;
}

function empty(date: string): MealGateState {
  return { date, ate: null };
}

export async function getMealGate(dateIso: string): Promise<MealGateState> {
  const s = await getSetting<MealGateState | null>(KEY, null);
  if (!s || s.date !== dateIso) return empty(dateIso);
  return s;
}

export async function setMealGate(
  patch: Partial<MealGateState> & { date: string }
): Promise<MealGateState> {
  const cur = await getMealGate(patch.date);
  const next = { ...cur, ...patch, date: patch.date };
  await setSetting(KEY, next);
  return next;
}

/**
 * Morning eat ask window — MUST be before leave-home, not after college.
 * Weekdays: 05:00–07:00 (breakfast is part of morning routine; leave ~06:00).
 * Sunday: 07:00–10:00 (no college rush).
 * Never ask after the morning window so it does not pop up on the bus / at college.
 */
export function mealAskAfterMinutes(date: Date): number {
  return date.getDay() === 0 ? 7 * 60 : 5 * 60;
}

/** Upper bound (exclusive) of the morning eat ask window. */
export function mealAskUntilMinutes(date: Date): number {
  return date.getDay() === 0 ? 10 * 60 : 7 * 60;
}

export function shouldAskMeal(now: Date, state: MealGateState): boolean {
  if (state.ate === true) return false;
  if (state.ate === false && state.eatAtHm) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= mealAskAfterMinutes(now) && mins < mealAskUntilMinutes(now);
}

export function shouldAlertEat(now: Date, state: MealGateState): boolean {
  if (state.ate === true || !state.eatAtHm) return false;
  const [h, m] = state.eatAtHm.split(':').map(Number);
  if (Number.isNaN(h)) return false;
  const target = h * 60 + (m || 0);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= target && !state.remindedAt;
}

export function isFreeTimeUnlocked(now: Date, state: MealGateState): boolean {
  if (state.ate === true && state.freeTimeAfterIso) {
    return now.getTime() >= new Date(state.freeTimeAfterIso).getTime();
  }
  if (state.ate === true && !state.freeTimeAfterIso) return true;
  return false;
}
