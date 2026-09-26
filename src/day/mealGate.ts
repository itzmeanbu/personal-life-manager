/**
 * Simple "did you eat?" gate around late morning / post-activity.
 * Stores answers in app settings — real, per local date.
 */
import { getSetting, setSetting } from '../data/settings';

const KEY = 'day.mealGate';

export interface MealGateState {
  date: string; // yyyy-mm-dd
  /** null = not asked yet */
  ate: boolean | null;
  /** When they said they'll eat, "HH:mm" */
  eatAtHm?: string;
  /** ISO when 30-min post-meal break ends → night free time */
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

export async function setMealGate(patch: Partial<MealGateState> & { date: string }): Promise<MealGateState> {
  const cur = await getMealGate(patch.date);
  const next = { ...cur, ...patch, date: patch.date };
  await setSetting(KEY, next);
  return next;
}

/** True when local time is at/after 07:30 and meal not confirmed. */
export function shouldAskMeal(now: Date, state: MealGateState): boolean {
  if (state.ate === true) return false;
  if (state.ate === false && state.eatAtHm) {
    // already said no and picked a time — don't re-ask the first question
    return false;
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 7 * 60 + 30; // 07:30
}

/** True when it's time to alert "eat now". */
export function shouldAlertEat(now: Date, state: MealGateState): boolean {
  if (state.ate === true || !state.eatAtHm) return false;
  const [h, m] = state.eatAtHm.split(':').map(Number);
  if (Number.isNaN(h)) return false;
  const target = h * 60 + (m || 0);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= target && !state.remindedAt;
}

/** True when post-meal 30min break is over → night / free-time mode. */
export function isFreeTimeUnlocked(now: Date, state: MealGateState): boolean {
  if (state.ate === true && state.freeTimeAfterIso) {
    return now.getTime() >= new Date(state.freeTimeAfterIso).getTime();
  }
  // If they ate immediately, unlock after 30 min from answer
  if (state.ate === true && !state.freeTimeAfterIso) return true;
  return false;
}
