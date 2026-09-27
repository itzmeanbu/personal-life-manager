/**
 * Deterministic water scheduling engine (offline, no AI).
 *
 * User configures only: daily goal, serving size, optional start/end.
 * Remaining water is distributed across the remaining usable day.
 * Weekend day starts at configured weekend wake time.
 * Missed reminders → recalculate; never stack unrealistic close reminders.
 */

import type { WaterLog, WaterSettings } from '../data/types';
import { getSetting, setSetting } from '../data/settings';
import { isWeekend, hmToMinutes, minutesToHm, parseHm } from '../spin/timeBudget';

export const WATER_SETTINGS_KEY = 'water.settings';

export const DEFAULT_WATER_SETTINGS: WaterSettings = {
  dailyGoalMl: 2000,
  servingMl: 250,
  preferredStartHm: null,
  preferredEndHm: null,
  enabled: true,
};

/** Minimum gap between suggested water times (minutes). */
const MIN_GAP_MINUTES = 45;
/** Default end before night routine. */
const DEFAULT_END_HM = '21:30';
/** Default weekday start. */
const DEFAULT_WEEKDAY_START_HM = '08:00';
/** Default weekend start (aligned with typical weekend wake). */
const DEFAULT_WEEKEND_START_HM = '14:30';

export async function getWaterSettings(): Promise<WaterSettings> {
  return getSetting<WaterSettings>(WATER_SETTINGS_KEY, DEFAULT_WATER_SETTINGS);
}

export async function setWaterSettings(partial: Partial<WaterSettings>): Promise<WaterSettings> {
  const cur = await getWaterSettings();
  const next = { ...cur, ...partial };
  await setSetting(WATER_SETTINGS_KEY, next);
  return next;
}

export function sumConsumedMl(logs: WaterLog[], dateIso: string): number {
  return logs
    .filter((l) => !l.deleted && l.date === dateIso)
    .reduce((s, l) => s + (l.amountMl || 0), 0);
}

export interface WaterScheduleSlot {
  hm: string;
  amountMl: number;
  /** Past slots that were not logged are considered missed; engine recalculates. */
  index: number;
}

export interface WaterDayPlan {
  settings: WaterSettings;
  goalMl: number;
  consumedMl: number;
  remainingMl: number;
  progress: number; // 0–1
  servingsLeft: number;
  slots: WaterScheduleSlot[];
  /** Next suggested time from now, if any. */
  nextHm: string | null;
  nextAmountMl: number;
}

export interface WaterPlanInput {
  now?: Date;
  dateIso: string;
  settings: WaterSettings;
  logs: WaterLog[];
  /** Weekend wake "HH:mm" when isWeekend. */
  weekendWakeHm?: string | null;
  /** Night/sleep start "HH:mm" to avoid scheduling after. */
  sleepStartHm?: string | null;
}

/**
 * Distribute remaining water servings across remaining usable day.
 * Avoids times before wake and after sleep/end preference.
 */
export function computeWaterPlan(input: WaterPlanInput): WaterDayPlan {
  const now = input.now ?? new Date();
  const settings = input.settings;
  const goal = Math.max(0, settings.dailyGoalMl || 0);
  const serving = Math.max(50, settings.servingMl || 250);
  const consumed = sumConsumedMl(input.logs, input.dateIso);
  const remainingMl = Math.max(0, goal - consumed);
  const servingsLeft = remainingMl <= 0 ? 0 : Math.ceil(remainingMl / serving);
  const progress = goal > 0 ? Math.min(1, consumed / goal) : 0;

  if (!settings.enabled || servingsLeft === 0) {
    return {
      settings,
      goalMl: goal,
      consumedMl: consumed,
      remainingMl,
      progress,
      servingsLeft: 0,
      slots: [],
      nextHm: null,
      nextAmountMl: 0,
    };
  }

  const weekend = isWeekend(now);
  const startHm =
    settings.preferredStartHm ||
    (weekend ? input.weekendWakeHm || DEFAULT_WEEKEND_START_HM : DEFAULT_WEEKDAY_START_HM);
  const endHm =
    settings.preferredEndHm ||
    input.sleepStartHm ||
    DEFAULT_END_HM;

  const startMin = hmToMinutes(startHm) ?? (weekend ? 14 * 60 + 30 : 8 * 60);
  const endMin = hmToMinutes(endHm) ?? 21 * 60 + 30;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Usable window from max(now, start) to end
  let windowStart = Math.max(startMin, nowMin);
  // Small buffer so we don't suggest "now" instantly if user just drank
  if (windowStart === nowMin) windowStart = nowMin + 5;
  const windowEnd = endMin;

  if (windowStart >= windowEnd || servingsLeft <= 0) {
    return {
      settings,
      goalMl: goal,
      consumedMl: consumed,
      remainingMl,
      progress,
      servingsLeft,
      slots: [],
      nextHm: null,
      nextAmountMl: 0,
    };
  }

  const span = windowEnd - windowStart;
  // Space servings evenly, enforcing minimum gap
  const idealGap = Math.floor(span / Math.max(1, servingsLeft));
  const gap = Math.max(MIN_GAP_MINUTES, idealGap);

  const slots: WaterScheduleSlot[] = [];
  let t = windowStart;
  let leftMl = remainingMl;
  for (let i = 0; i < servingsLeft; i++) {
    if (t >= windowEnd) break;
    const amount = i === servingsLeft - 1 ? leftMl : Math.min(serving, leftMl);
    if (amount <= 0) break;
    slots.push({ hm: minutesToHm(t), amountMl: amount, index: i });
    leftMl -= amount;
    t += gap;
  }

  const next = slots[0] ?? null;
  return {
    settings,
    goalMl: goal,
    consumedMl: consumed,
    remainingMl,
    progress,
    servingsLeft,
    slots,
    nextHm: next?.hm ?? null,
    nextAmountMl: next?.amountMl ?? 0,
  };
}

/** Simple reminder copy. */
export function waterReminderCopy(amountMl: number): { title: string; body: string } {
  return {
    title: '💧 Time for some water',
    body: `${amountMl} ml`,
  };
}
