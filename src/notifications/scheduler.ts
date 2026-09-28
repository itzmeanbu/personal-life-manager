/**
 * Real phone notifications (Capacitor Local Notifications) with a
 * foreground-only browser fallback. Everything is optional and the user
 * picks each type in Settings.
 *
 * Needs: npm i @capacitor/local-notifications  then  npx cap sync
 */
import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from '../data/settings';
import { toIsoDate } from '../routine/engine';
import { SPEND_PROMPTS, getTomorrowOrder } from '../day/spendPrompts';
import {
  coach,
  getWakeCoachConfig,
  getWakeTime,
  hmToMin,
  minToHm,
} from '../day/wakeCoach';
import { getTravel, hasBoardedOut } from '../day/travel';
import { isCoachDay, isCollegeLikeDay } from '../day/dayContext';
import type { DayTypeKey } from '../day/dayTypes';

const CFG_KEY = 'notify.config.v1';

export type NotifyTypeId =
  | 'wake_water'
  | 'wake_eat'
  | 'coach_leave'
  | 'coach_missed'
  | 'spend'
  | 'night_routine'
  | 'tomorrow_type';

export interface NotifyTypeCfg {
  on: boolean;
  /** Fixed clock time for night_routine / tomorrow_type. */
  time?: string;
}

export interface AlarmCfg {
  on: boolean;
  time: string;
}

export interface NotifyConfig {
  master: boolean;
  types: Record<NotifyTypeId, NotifyTypeCfg>;
  /** Optional wake alarm per day type (off by default where wake is free). */
  alarms: Record<DayTypeKey, AlarmCfg>;
}

export const NOTIFY_LABELS: Record<NotifyTypeId, { label: string; hint: string; hasTime?: boolean }> = {
  wake_water: { label: 'Water after waking', hint: 'Every day type' },
  wake_eat: { label: 'Eat something after waking', hint: 'Every day type' },
  coach_leave: { label: 'Time to leave for the bus', hint: 'Campus and Early Exit days' },
  coach_missed: { label: 'Bus missed message', hint: 'Campus and Early Exit days' },
  spend: { label: 'Spending check-ins', hint: 'Break, lunch, canteen, xerox, commute', },
  night_routine: { label: 'Night routine', hint: 'Bath, serum, workout, guitar', hasTime: true },
  tomorrow_type: { label: 'Pick tomorrow\'s day type', hint: 'Before sleep', hasTime: true },
};

export const DEFAULT_NOTIFY: NotifyConfig = {
  master: true,
  types: {
    wake_water: { on: true },
    wake_eat: { on: true },
    coach_leave: { on: true },
    coach_missed: { on: true },
    spend: { on: true },
    night_routine: { on: true, time: '21:30' },
    tomorrow_type: { on: true, time: '21:45' },
  },
  alarms: {
    normal: { on: true, time: '05:00' },
    bunk: { on: true, time: '05:00' },
    event: { on: false, time: '06:30' },
    rest: { on: false, time: '08:00' },
    deep_work: { on: false, time: '07:00' },
    coimbatore_stay: { on: false, time: '07:30' },
  },
};

export async function getNotifyConfig(): Promise<NotifyConfig> {
  const s = await getSetting<Partial<NotifyConfig> | null>(CFG_KEY, null);
  if (!s) return structuredClone(DEFAULT_NOTIFY);
  const types = { ...DEFAULT_NOTIFY.types } as NotifyConfig['types'];
  for (const k of Object.keys(types) as NotifyTypeId[]) {
    types[k] = { ...types[k], ...(s.types?.[k] ?? {}) };
  }
  const alarms = { ...DEFAULT_NOTIFY.alarms } as NotifyConfig['alarms'];
  for (const k of Object.keys(alarms) as DayTypeKey[]) {
    alarms[k] = { ...alarms[k], ...(s.alarms?.[k] ?? {}) };
  }
  return { master: s.master ?? true, types, alarms };
}

export async function setNotifyConfig(next: NotifyConfig): Promise<void> {
  await setSetting(CFG_KEY, next);
  await rescheduleAllNotifications();
}

/* ------------------------------ platform ------------------------------ */

async function nativePlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    return mod.LocalNotifications;
  } catch {
    return null;
  }
}

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

export async function notificationPermission(): Promise<PermissionResult> {
  const p = await nativePlugin();
  if (p) {
    const r = await p.checkPermissions();
    return r.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'granted' ? 'granted' : 'denied';
}

export async function requestNotificationPermission(): Promise<PermissionResult> {
  const p = await nativePlugin();
  if (p) {
    const r = await p.requestPermissions();
    if (r.display === 'granted') void rescheduleAllNotifications();
    return r.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  const r = await Notification.requestPermission();
  if (r === 'granted') void rescheduleAllNotifications();
  return r === 'granted' ? 'granted' : 'denied';
}

/* ------------------------------ building the list ------------------------------ */

interface Planned {
  key: string;
  at: Date;
  title: string;
  body: string;
}

function atTime(base: Date, hm: string): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(hmToMin(hm));
  return d;
}

function stableId(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return Math.abs(h % 2147483000) + 1;
}

const ORDER_TO_TYPE: Record<string, DayTypeKey> = {
  college: 'normal',
  bunk: 'bunk',
  event: 'event',
  rest: 'rest',
  leave: 'rest',
  deep_work: 'deep_work',
  coimbatore_stay: 'coimbatore_stay',
};

export async function planNotifications(now = new Date()): Promise<Planned[]> {
  const cfg = await getNotifyConfig();
  if (!cfg.master) return [];
  const wake = await getWakeCoachConfig();
  const out: Planned[] = [];

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayIso = toIsoDate(today);
  const tomorrowIso = toIsoDate(tomorrow);

  // ---- today ----
  const wakeAt = await getWakeTime(todayIso);
  if (wakeAt) {
    if (cfg.types.wake_water.on) {
      out.push({
        key: `water:${todayIso}`,
        at: new Date(wakeAt.getTime() + wake.waterAfterMin * 60000),
        title: 'Water first',
        body: 'Drink water before anything else.',
      });
    }
    if (cfg.types.wake_eat.on) {
      out.push({
        key: `eat:${todayIso}`,
        at: new Date(wakeAt.getTime() + wake.eatAfterMin * 60000),
        title: 'Eat something',
        body: 'Time to eat. Do not skip it.',
      });
    }
  }

  if (await isCoachDay(today)) {
    const travel = await getTravel(todayIso);
    const boarded = hasBoardedOut(travel);
    if (!boarded) {
      const res = coach(now, wakeAt, false, wake);
      if (cfg.types.coach_leave.on && res.leaveBy) {
        out.push({
          key: `leave:${todayIso}`,
          at: atTime(today, res.leaveBy),
          title: `Leave now for the ${res.bus} bus`,
          body: res.message,
        });
      }
      if (cfg.types.coach_missed.on) {
        out.push({
          key: `missed:${todayIso}`,
          at: atTime(today, wake.missedAfter),
          title: 'Bus check',
          body: wake.messages.missed,
        });
      }
    }
  }

  if (cfg.types.spend.on && (await isCollegeLikeDay(today))) {
    for (const p of SPEND_PROMPTS) {
      out.push({
        key: `spend:${todayIso}:${p.id}`,
        at: atTime(today, minToHm(p.startMin)),
        title: p.notifyTitle,
        body: p.notifyBody,
      });
    }
  }

  // ---- tonight and tomorrow night ----
  for (const [base, iso] of [
    [today, todayIso],
    [tomorrow, tomorrowIso],
  ] as [Date, string][]) {
    if (cfg.types.night_routine.on) {
      out.push({
        key: `night:${iso}`,
        at: atTime(base, cfg.types.night_routine.time ?? '21:30'),
        title: 'Night routine',
        body: 'Bath, serum, workout or guitar, then sleep.',
      });
    }
    if (cfg.types.tomorrow_type.on) {
      out.push({
        key: `tomorrowtype:${iso}`,
        at: atTime(base, cfg.types.tomorrow_type.time ?? '21:45'),
        title: "Tomorrow's day type",
        body: 'Campus, Early Exit, Event, Recharge, Deep Work or Coimbatore Stay?',
      });
    }
  }

  // ---- tomorrow: optional alarm + spend prompts, based on the picked type ----
  const picked = await getTomorrowOrder(tomorrowIso);
  const typeKey = picked && picked.order !== 'unset' ? ORDER_TO_TYPE[picked.order] : undefined;
  if (typeKey) {
    const alarm = cfg.alarms[typeKey];
    if (alarm?.on) {
      out.push({
        key: `alarm:${tomorrowIso}`,
        at: atTime(tomorrow, alarm.time),
        title: 'Wake up',
        body: 'Good morning. Tap I\'m awake in the app.',
      });
    }
    if (cfg.types.spend.on && (typeKey === 'normal' || typeKey === 'bunk' || typeKey === 'event')) {
      for (const p of SPEND_PROMPTS) {
        out.push({
          key: `spend:${tomorrowIso}:${p.id}`,
          at: atTime(tomorrow, minToHm(p.startMin)),
          title: p.notifyTitle,
          body: p.notifyBody,
        });
      }
    }
  }

  return out.filter((n) => n.at.getTime() > now.getTime() + 5000);
}

/* ------------------------------ scheduling ------------------------------ */

let webTimers: number[] = [];

export async function rescheduleAllNotifications(): Promise<void> {
  try {
    const planned = await planNotifications();
    const plugin = await nativePlugin();

    if (plugin) {
      const perm = await plugin.checkPermissions();
      const pending = await plugin.getPending();
      if (pending.notifications.length > 0) {
        await plugin.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
      if (perm.display !== 'granted' || planned.length === 0) return;
      await plugin.schedule({
        notifications: planned.map((n) => ({
          id: stableId(n.key),
          title: n.title,
          body: n.body,
          schedule: { at: n.at, allowWhileIdle: true },
        })),
      });
      return;
    }

    // Browser fallback: only fires while the app is open.
    webTimers.forEach((t) => window.clearTimeout(t));
    webTimers = [];
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const horizon = Date.now() + 12 * 3600 * 1000;
    for (const n of planned) {
      const wait = n.at.getTime() - Date.now();
      if (wait <= 0 || n.at.getTime() > horizon) continue;
      webTimers.push(
        window.setTimeout(() => {
          try {
            new Notification(n.title, { body: n.body });
          } catch {
            /* ignore */
          }
        }, wait)
      );
    }
  } catch {
    /* notifications are best-effort */
  }
}

let started = false;
export async function initNotifications(): Promise<void> {
  if (started) return;
  started = true;
  await rescheduleAllNotifications();
  // Re-plan every 30 minutes and when the app comes back to the foreground.
  window.setInterval(() => void rescheduleAllNotifications(), 30 * 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void rescheduleAllNotifications();
  });
}
