/**
 * Water goal + timed wellness nudges (sunscreen after noon, lip balm, water).
 * In-app only — not phone-wide screen-time (that needs Android Usage Access).
 */
import { getSetting, setSetting } from '../data/settings';

const CONFIG_KEY = 'day.wellness.config.v1';
const STATE_KEY = 'day.wellness.state.v1';

export interface WellnessConfig {
  /** Glasses / units per day target */
  waterGoal: number;
  /** ml per glass for display */
  mlPerGlass: number;
  /** Remind water every N minutes while app is open (soft) */
  waterIntervalMin: number;
  sunscreenAfterNoon: boolean;
  lipBalmEnabled: boolean;
}

export const DEFAULT_WELLNESS: WellnessConfig = {
  waterGoal: 8,
  mlPerGlass: 250,
  waterIntervalMin: 90,
  sunscreenAfterNoon: true,
  lipBalmEnabled: true,
};

export interface WellnessDayState {
  date: string;
  waterCount: number;
  sunscreenAfternoonDone: boolean;
  lipBalmDone: boolean;
  lastWaterRemindAt?: string;
  notified: {
    morningAsks?: boolean;
    sunscreenAfternoon?: boolean;
    water?: boolean;
  };
}

export async function getWellnessConfig(): Promise<WellnessConfig> {
  const s = await getSetting<Partial<WellnessConfig> | null>(CONFIG_KEY, null);
  return { ...DEFAULT_WELLNESS, ...s };
}

export async function setWellnessConfig(
  patch: Partial<WellnessConfig>
): Promise<WellnessConfig> {
  const cur = await getWellnessConfig();
  const next = { ...cur, ...patch };
  await setSetting(CONFIG_KEY, next);
  return next;
}

function empty(date: string): WellnessDayState {
  return {
    date,
    waterCount: 0,
    sunscreenAfternoonDone: false,
    lipBalmDone: false,
    notified: {},
  };
}

export async function getWellnessDay(dateIso: string): Promise<WellnessDayState> {
  const s = await getSetting<WellnessDayState | null>(STATE_KEY, null);
  if (!s || s.date !== dateIso) return empty(dateIso);
  return s;
}

export async function setWellnessDay(state: WellnessDayState): Promise<void> {
  await setSetting(STATE_KEY, state);
}

export async function addWater(dateIso: string, n = 1): Promise<WellnessDayState> {
  const s = await getWellnessDay(dateIso);
  const next = {
    ...s,
    date: dateIso,
    waterCount: Math.max(0, s.waterCount + n),
  };
  await setWellnessDay(next);
  return next;
}

export async function markSunscreenAfternoon(dateIso: string): Promise<WellnessDayState> {
  const s = await getWellnessDay(dateIso);
  const next = { ...s, date: dateIso, sunscreenAfternoonDone: true };
  await setWellnessDay(next);
  return next;
}

export async function markLipBalm(dateIso: string): Promise<WellnessDayState> {
  const s = await getWellnessDay(dateIso);
  const next = { ...s, date: dateIso, lipBalmDone: true };
  await setWellnessDay(next);
  return next;
}

export function shouldAskSunscreenAfternoon(
  now: Date,
  state: WellnessDayState,
  config: WellnessConfig
): boolean {
  if (!config.sunscreenAfterNoon) return false;
  if (state.sunscreenAfternoonDone) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  // After 12:00, before evening
  return m >= 12 * 60 && m < 18 * 60;
}

export function shouldRemindWater(
  now: Date,
  state: WellnessDayState,
  config: WellnessConfig
): boolean {
  if (state.waterCount >= config.waterGoal) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < 7 * 60 || m > 22 * 60) return false;
  if (!state.lastWaterRemindAt) return m >= 9 * 60;
  const last = new Date(state.lastWaterRemindAt).getTime();
  return now.getTime() - last >= config.waterIntervalMin * 60 * 1000;
}

/** Request permission + fire a browser/OS notification (best-effort). */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}
