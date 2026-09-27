/**
 * User-owned notification catalog.
 * Add / delete / change time windows — Day Brief + OS notifications follow this list.
 */
import { getSetting, setSetting } from '../data/settings';

const KEY = 'notify.catalog.v1';

export type NotifyKind = 'once' | 'interval' | 'window';

/** What Day Brief should surface when this notification is due. */
export type NotifyAction =
  | 'water'
  | 'sunscreen'
  | 'lip'
  | 'morning'
  | 'leave'
  | 'night'
  | 'commute'
  | 'canteen'
  | 'lunch'
  | 'home'
  | 'college'
  | 'college_early'
  | 'spin'
  | 'custom';

export interface NotifyRule {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  kind: NotifyKind;
  /** Clock times "HH:mm" for kind=once (can have several per day). */
  times: string[];
  /** Repeat every N minutes inside [startHm, endHm] when kind=interval. */
  intervalMin?: number;
  startHm?: string;
  endHm?: string;
  /** 0=Sun … 6=Sat. Empty = every day. */
  days: number[];
  action: NotifyAction;
  /** User-created (can delete). Seeded defaults are deletable too. */
  custom: boolean;
}

export const DEFAULT_RULES: NotifyRule[] = [
  {
    id: 'n_morning',
    title: 'Morning check',
    body: 'Yes / No on Day Brief — water, sunscreen, lip balm.',
    enabled: true,
    kind: 'once',
    times: ['07:00'],
    days: [],
    action: 'morning',
    custom: false,
  },
  {
    id: 'n_leave',
    title: 'Before you leave',
    body: 'ID, keys, wallet, bottle — Yes / No.',
    enabled: true,
    kind: 'once',
    times: ['08:15'],
    days: [1, 2, 3, 4, 5],
    action: 'leave',
    custom: false,
  },
  {
    id: 'n_college',
    title: 'Did you go to college today?',
    body: 'Answer on Day Brief or College — Attended / Left early / Bunked.',
    enabled: true,
    kind: 'once',
    times: ['09:30'],
    days: [1, 2, 3, 4, 5],
    action: 'college',
    custom: false,
  },
  {
    id: 'n_college_early',
    title: 'Leaving college early?',
    body: 'If you leave early, set free-time start so Spin can open automatically.',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '14:00',
    endHm: '17:30',
    days: [1, 2, 3, 4, 5],
    action: 'college_early',
    custom: false,
  },
  {
    id: 'n_water',
    title: '💧 Time for some water',
    body: '250 ml — log on Day Brief.',
    enabled: true,
    kind: 'interval',
    times: [],
    intervalMin: 90,
    startHm: '08:00',
    endHm: '21:30',
    days: [],
    action: 'water',
    custom: false,
  },
  {
    id: 'n_sunscreen_am',
    title: 'Morning sunscreen',
    body: 'Apply sunscreen before you head out.',
    enabled: true,
    kind: 'once',
    times: ['07:30'],
    days: [1, 2, 3, 4, 5],
    action: 'sunscreen',
    custom: false,
  },
  {
    id: 'n_sunscreen_pm',
    title: 'Reapply sunscreen',
    body: 'After noon at college — sunscreen again.',
    enabled: true,
    kind: 'once',
    times: ['13:00'],
    days: [1, 2, 3, 4, 5],
    action: 'sunscreen',
    custom: false,
  },
  {
    id: 'n_lip',
    title: 'Lip balm',
    body: 'Apply lip balm.',
    enabled: true,
    kind: 'once',
    times: ['08:00', '16:00'],
    days: [],
    action: 'lip',
    custom: false,
  },
  {
    id: 'n_commute_am',
    title: 'Commute spend',
    body: 'How much did you spend getting to college?',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '07:30',
    endHm: '09:30',
    days: [1, 2, 3, 4, 5],
    action: 'commute',
    custom: false,
  },
  {
    id: 'n_break',
    title: 'Break spend',
    body: '10:50 break — did you buy anything?',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '10:50',
    endHm: '11:20',
    days: [1, 2, 3, 4, 5],
    action: 'canteen',
    custom: false,
  },
  {
    id: 'n_lunch',
    title: 'Lunch spend',
    body: 'Did you eat? How much?',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '11:50',
    endHm: '13:30',
    days: [1, 2, 3, 4, 5],
    action: 'lunch',
    custom: false,
  },
  {
    id: 'n_tea',
    title: 'Canteen / tea stall',
    body: 'After 4:30 — did you go to canteen? Amount?',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '16:30',
    endHm: '18:00',
    days: [1, 2, 3, 4, 5],
    action: 'canteen',
    custom: false,
  },
  {
    id: 'n_commute_pm',
    title: 'Return commute',
    body: 'How much for the ride home?',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '16:00',
    endHm: '21:00',
    days: [1, 2, 3, 4, 5],
    action: 'commute',
    custom: false,
  },
  {
    id: 'n_home',
    title: 'Heading home?',
    body: 'Near home? Turn tracking on until you arrive.',
    enabled: true,
    kind: 'window',
    times: [],
    startHm: '16:30',
    endHm: '21:00',
    days: [1, 2, 3, 4, 5],
    action: 'home',
    custom: false,
  },
  {
    id: 'n_night',
    title: 'Night close + tomorrow',
    body: 'Night Yes/No and tomorrow’s day order.',
    enabled: true,
    kind: 'once',
    times: ['21:00'],
    days: [],
    action: 'night',
    custom: false,
  },
];

export async function getNotifyRules(): Promise<NotifyRule[]> {
  const stored = await getSetting<NotifyRule[] | null>(KEY, null);
  if (!stored || stored.length === 0) {
    await setSetting(KEY, DEFAULT_RULES);
    return DEFAULT_RULES.map((r) => ({ ...r }));
  }
  return stored;
}

export async function setNotifyRules(rules: NotifyRule[]): Promise<void> {
  await setSetting(KEY, rules);
}

export async function upsertNotifyRule(rule: NotifyRule): Promise<NotifyRule[]> {
  const all = await getNotifyRules();
  const i = all.findIndex((r) => r.id === rule.id);
  if (i >= 0) all[i] = rule;
  else all.push(rule);
  await setNotifyRules(all);
  return all;
}

export async function deleteNotifyRule(id: string): Promise<NotifyRule[]> {
  const all = (await getNotifyRules()).filter((r) => r.id !== id);
  await setNotifyRules(all);
  return all;
}

export function parseHm(hm: string): number {
  const [h, m] = (hm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function formatHm(min: number): string {
  const h = Math.floor(((min % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ruleAppliesToday(rule: NotifyRule, now = new Date()): boolean {
  if (!rule.enabled) return false;
  if (!rule.days.length) return true;
  return rule.days.includes(now.getDay());
}

/** Is this rule in its active clock window right now? */
export function ruleIsDue(rule: NotifyRule, now = new Date()): boolean {
  if (!ruleAppliesToday(rule, now)) return false;
  const m = minutesNow(now);
  if (rule.kind === 'once') {
    return rule.times.some((t) => {
      const target = parseHm(t);
      // due for 20 minutes after scheduled time
      return m >= target && m < target + 20;
    });
  }
  const start = parseHm(rule.startHm ?? '00:00');
  const end = parseHm(rule.endHm ?? '23:59');
  if (end >= start) return m >= start && m <= end;
  return m >= start || m <= end; // overnight
}

export function ruleScheduleLabel(rule: NotifyRule): string {
  if (rule.kind === 'once') {
    return rule.times.length ? rule.times.join(', ') : 'no time set';
  }
  if (rule.kind === 'interval') {
    return `every ${rule.intervalMin ?? 60} min · ${rule.startHm ?? '—'}–${rule.endHm ?? '—'}`;
  }
  return `${rule.startHm ?? '—'}–${rule.endHm ?? '—'}`;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
