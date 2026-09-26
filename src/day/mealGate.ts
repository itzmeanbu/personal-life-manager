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

/** Minutes past midnight when we first ask about food. */
export function mealAskAfterMinutes(date: Date): number {
  // Sunday → 07:30; other days → 08:00 (after typical wash/bath block)
  return date.getDay() === 0 ? 7 * 60 + 30 : 8 * 60;
}

export function shouldAskMeal(now: Date, state: MealGateState): boolean {
  if (state.ate === true) return false;
  if (state.ate === false && state.eatAtHm) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= mealAskAfterMinutes(now);
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
