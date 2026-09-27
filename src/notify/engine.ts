/**
 * Fires catalog notifications at the times the user set.
 * Works while the app is open / in foreground (web + Capacitor WebView).
 * Android APK: grant Notifications for banners.
 */
import {
  getNotifyRules,
  ruleIsDue,
  parseHm,
  minutesNow,
  type NotifyRule,
} from './catalog';
import { getSetting, setSetting } from '../data/settings';
import { toIsoDate } from '../routine/engine';

const FIRED_KEY = 'notify.fired.v1';

interface FiredState {
  date: string;
  /** ruleId + slot key already fired today */
  keys: string[];
}

function fireKey(rule: NotifyRule, now: Date): string {
  const m = minutesNow(now);
  if (rule.kind === 'once') {
    const hit = rule.times.find((t) => {
      const target = parseHm(t);
      return m >= target && m < target + 20;
    });
    return `${rule.id}@once@${hit ?? 'x'}`;
  }
  if (rule.kind === 'interval') {
    const start = parseHm(rule.startHm ?? '00:00');
    const step = Math.max(15, rule.intervalMin ?? 90);
    const slot = Math.floor((m - start) / step);
    return `${rule.id}@int@${slot}`;
  }
  // window: fire once when window opens
  return `${rule.id}@win@${rule.startHm ?? 'x'}`;
}

async function getFired(dateIso: string): Promise<FiredState> {
  const s = await getSetting<FiredState | null>(FIRED_KEY, null);
  if (!s || s.date !== dateIso) return { date: dateIso, keys: [] };
  return s;
}

export async function requestNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  try {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function fireOsNotification(title: string, body: string): Promise<void> {
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

export interface DueTick {
  due: NotifyRule[];
  fired: NotifyRule[];
}

/** Check catalog vs clock. Fire any newly due rules. */
export async function tickNotifications(now = new Date()): Promise<DueTick> {
  const iso = toIsoDate(now);
  const rules = await getNotifyRules();
  const firedState = await getFired(iso);
  const due = rules.filter((r) => ruleIsDue(r, now));
  const newly: NotifyRule[] = [];

  for (const r of due) {
    const key = fireKey(r, now);
    if (firedState.keys.includes(key)) continue;
    firedState.keys.push(key);
    newly.push(r);
    await fireOsNotification(r.title, r.body);
  }

  if (newly.length) {
    await setSetting(FIRED_KEY, firedState);
  }

  return { due, fired: newly };
}

export async function dueRulesNow(now = new Date()): Promise<NotifyRule[]> {
  const rules = await getNotifyRules();
  return rules.filter((r) => ruleIsDue(r, now));
}
