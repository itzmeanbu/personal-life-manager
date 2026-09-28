/**
 * Flexible wake-up + Wake Coach (pure logic + settings).
 * Nothing forces an alarm. The user taps "I'm awake" and the day
 * rebuilds from the real wake time.
 */
import { getSetting, setSetting } from '../data/settings';

const CFG_KEY = 'day.wake.config.v1';
const LOG_KEY = 'day.wake.log.v1';
const DONE_KEY = 'day.wake.done.v1';

export interface RoutineStep {
  label: string;
  minutes: number;
  /** Can be dropped when time is very short. */
  optional?: boolean;
}

export interface WakeCoachConfig {
  enabled: boolean;
  planA: { wakeBy: string; bus: string; arrive: string };
  planB: { wakeBy: string; bus: string; arrive: string };
  /** After this time with no "Boarded bus" logged, the bus is counted as missed. */
  missedAfter: string;
  /** Minutes needed to reach the bus stop. */
  leaveBufferMin: number;
  steps: RoutineStep[];
  messages: {
    waiting: string;
    onTrack: string;
    planB: string;
    rush: string;
    missed: string;
    boarded: string;
  };
  /** Water and eating reminders after waking (all day types). */
  waterAfterMin: number;
  eatAfterMin: number;
}

export const DEFAULT_WAKE_COACH: WakeCoachConfig = {
  enabled: true,
  planA: { wakeBy: '05:10', bus: '06:15', arrive: '09:10' },
  planB: { wakeBy: '05:45', bus: '06:50', arrive: '10:00' },
  missedAfter: '07:00',
  leaveBufferMin: 15,
  steps: [
    { label: 'Brush + wash', minutes: 10 },
    { label: 'Serum + skincare', minutes: 8, optional: true },
    { label: 'Take your things (bag, ID, wallet)', minutes: 7 },
    { label: 'Water + something light', minutes: 5, optional: true },
  ],
  messages: {
    waiting: "Tap 'I'm awake' the moment u wake up vro.",
    onTrack: 'On track vro 🔥 {bus} bus fixed. Follow the steps, no scrolling.',
    planB: 'Konjam late vro, but Plan B irukku. Catch the {bus} bus, reach by {arrive}.',
    rush: 'Semma late vro! Only {mins} min for the {bus} bus. Essentials only, go go!',
    missed: 'Sleep vro, u missed the bus, relax.',
    boarded: 'Bus la iruka vro, music on, chill.',
  },
  waterAfterMin: 5,
  eatAfterMin: 45,
};

export async function getWakeCoachConfig(): Promise<WakeCoachConfig> {
  const s = await getSetting<Partial<WakeCoachConfig> | null>(CFG_KEY, null);
  if (!s) return { ...DEFAULT_WAKE_COACH };
  return {
    ...DEFAULT_WAKE_COACH,
    ...s,
    planA: { ...DEFAULT_WAKE_COACH.planA, ...(s.planA ?? {}) },
    planB: { ...DEFAULT_WAKE_COACH.planB, ...(s.planB ?? {}) },
    messages: { ...DEFAULT_WAKE_COACH.messages, ...(s.messages ?? {}) },
    steps: s.steps ?? DEFAULT_WAKE_COACH.steps,
  };
}

export async function setWakeCoachConfig(patch: Partial<WakeCoachConfig>): Promise<void> {
  const cur = await getWakeCoachConfig();
  await setSetting(CFG_KEY, { ...cur, ...patch });
}

/* ------------------------------ wake log ------------------------------ */

export type WakeLog = Record<string, string>; // date -> ISO time

export async function getWakeLog(): Promise<WakeLog> {
  return (await getSetting<WakeLog | null>(LOG_KEY, null)) ?? {};
}

export async function getWakeTime(dateIso: string): Promise<Date | null> {
  const l = await getWakeLog();
  return l[dateIso] ? new Date(l[dateIso]) : null;
}

export async function logWake(dateIso: string, at = new Date()): Promise<void> {
  const l = await getWakeLog();
  // Keep only the last 60 days so the setting stays small.
  const keys = Object.keys(l).sort().slice(-60);
  const trimmed: WakeLog = {};
  for (const k of keys) trimmed[k] = l[k];
  trimmed[dateIso] = at.toISOString();
  await setSetting(LOG_KEY, trimmed);
}

export async function clearWake(dateIso: string): Promise<void> {
  const l = await getWakeLog();
  delete l[dateIso];
  await setSetting(LOG_KEY, l);
}

/* ------------------------------ water / eat done ------------------------------ */

export interface WakeDone {
  date: string;
  water: boolean;
  eat: boolean;
}

export async function getWakeDone(dateIso: string): Promise<WakeDone> {
  const s = await getSetting<WakeDone | null>(DONE_KEY, null);
  if (!s || s.date !== dateIso) return { date: dateIso, water: false, eat: false };
  return s;
}
export async function setWakeDone(next: WakeDone): Promise<void> {
  await setSetting(DONE_KEY, next);
}

/* ------------------------------ pure helpers ------------------------------ */

export function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}
export function minToHm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function dateMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export type CoachStage = 'waiting' | 'on_track' | 'plan_b' | 'rush' | 'missed' | 'boarded';

export interface CoachStep {
  label: string;
  start: string;
  end: string;
  dropped?: boolean;
}

export interface CoachResult {
  stage: CoachStage;
  message: string;
  bus: string | null;
  arrive: string | null;
  leaveBy: string | null;
  minutesToBus: number | null;
  steps: CoachStep[];
  /** True when optional steps were dropped to make the bus. */
  compressed: boolean;
}

function fill(msg: string, vars: Record<string, string | number>): string {
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Build a step-by-step plan from the real wake time. */
export function buildSteps(
  wakeMin: number,
  leaveByMin: number,
  steps: RoutineStep[]
): { list: CoachStep[]; compressed: boolean } {
  const available = leaveByMin - wakeMin;
  let chosen = steps.map((s) => ({ ...s, dropped: false }));
  let total = chosen.reduce((n, s) => n + s.minutes, 0);
  let compressed = false;
  if (total > available) {
    // Drop optional steps from the end until it fits.
    for (let i = chosen.length - 1; i >= 0 && total > available; i--) {
      if (chosen[i].optional && !chosen[i].dropped) {
        chosen[i].dropped = true;
        total -= chosen[i].minutes;
        compressed = true;
      }
    }
  }
  let t = wakeMin;
  const list: CoachStep[] = chosen.map((s) => {
    if (s.dropped) return { label: s.label, start: '', end: '', dropped: true };
    const start = t;
    t += s.minutes;
    return { label: s.label, start: minToHm(start), end: minToHm(t) };
  });
  return { list, compressed };
}

export function coach(
  now: Date,
  wakeAt: Date | null,
  boarded: boolean,
  cfg: WakeCoachConfig
): CoachResult {
  const nowMin = dateMinutes(now);
  const base: CoachResult = {
    stage: 'waiting',
    message: cfg.messages.waiting,
    bus: null,
    arrive: null,
    leaveBy: null,
    minutesToBus: null,
    steps: [],
    compressed: false,
  };

  if (boarded) return { ...base, stage: 'boarded', message: cfg.messages.boarded };
  if (nowMin >= hmToMin(cfg.missedAfter)) {
    return { ...base, stage: 'missed', message: cfg.messages.missed };
  }
  if (!wakeAt) return base;

  const wakeMin = dateMinutes(wakeAt);
  const a = cfg.planA;
  const b = cfg.planB;

  let stage: CoachStage;
  let plan = a;
  if (wakeMin <= hmToMin(a.wakeBy)) {
    stage = 'on_track';
  } else if (wakeMin <= hmToMin(b.wakeBy)) {
    stage = 'plan_b';
    plan = b;
  } else {
    stage = 'rush';
    plan = b;
  }

  const busMin = hmToMin(plan.bus);
  const leaveBy = busMin - cfg.leaveBufferMin;
  const minutesToBus = busMin - nowMin;
  if (minutesToBus < 0) {
    // Plan B bus already gone and the "missed" time has not arrived yet.
    return { ...base, stage: 'missed', message: cfg.messages.missed };
  }
  const built = buildSteps(Math.max(wakeMin, 0), leaveBy, cfg.steps);
  const vars = { bus: plan.bus, arrive: plan.arrive, mins: minutesToBus };
  const msg =
    stage === 'on_track'
      ? cfg.messages.onTrack
      : stage === 'plan_b'
        ? cfg.messages.planB
        : cfg.messages.rush;

  return {
    stage,
    message: fill(msg, vars),
    bus: plan.bus,
    arrive: plan.arrive,
    leaveBy: minToHm(leaveBy),
    minutesToBus,
    steps: built.list,
    compressed: built.compressed,
  };
}
