/**
 * Late-wake college plan — pure logic.
 *
 * Travel ~2h45 bus. Period 1 ends 09:55. If you wake mid-morning the app
 * tells you whether you can still salvage the day (join after P1) or you're
 * cooked and should bunk / stay home.
 *
 * Thresholds are settings-backed so Control Center can tweak later.
 */

import { getSetting, setSetting } from '../data/settings';
import { TIME_SLOTS } from './timetable';
import { minToHm } from '../day/timeline';

export type LateWakeTier = 'on_time' | 'late_ok' | 'cooked';

export interface LateWakeConfig {
  /** Minutes-from-midnight: wake before this → normal full morning + on-time P1 */
  onTimeUntilMin: number;
  /** Wake after onTimeUntil and before this → rush + join after Period 1 */
  lateOkUntilMin: number;
  /** Bus one-way minutes (home → college) */
  busMinutes: number;
  /** How many minutes of “must do” morning stuff before leave when late_ok */
  rushMinutes: number;
}

export const DEFAULT_LATE_WAKE: LateWakeConfig = {
  onTimeUntilMin: 5 * 60 + 45, // 05:45
  lateOkUntilMin: 6 * 60 + 40, // 06:40 — 07:00 wake = cooked
  busMinutes: 165, // ~2h45
  rushMinutes: 35, // brush + face + quick eat + bag
};

const SETTING_KEY = 'college.lateWake';

export async function getLateWakeConfig(): Promise<LateWakeConfig> {
  const s = await getSetting<Partial<LateWakeConfig> | null>(SETTING_KEY, null);
  return { ...DEFAULT_LATE_WAKE, ...(s ?? {}) };
}

export async function setLateWakeConfig(patch: Partial<LateWakeConfig>): Promise<LateWakeConfig> {
  const cur = await getLateWakeConfig();
  const next = { ...cur, ...patch };
  await setSetting(SETTING_KEY, next);
  return next;
}

/** Period 1 end minutes (fallback 09:55). */
export function period1EndMin(): number {
  const p1 = TIME_SLOTS.find((s) => s.periodNo === 1);
  return p1?.endMin ?? 9 * 60 + 55;
}

export function period1StartMin(): number {
  const p1 = TIME_SLOTS.find((s) => s.periodNo === 1);
  return p1?.startMin ?? 9 * 60;
}

export interface LateWakePlan {
  tier: LateWakeTier;
  wakeMin: number;
  /** Headline the UI shows */
  title: string;
  /** Body copy — direct, useful, a bit roast when deserved */
  body: string;
  /** Target leave clock HH:mm if still going */
  leaveByHm: string | null;
  /** Expected arrival HH:mm */
  arriveByHm: string | null;
  /** What to do with morning routines */
  routineAdvice: string[];
  /** Suggested college status action */
  suggestStatus: 'attended' | 'left_early' | 'bunked' | null;
  /** Severity for card styling */
  severity: 'ok' | 'warn' | 'danger';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Build the plan for a college weekday given logged wake minutes-from-midnight.
 * Returns null if wake is unknown.
 */
export function buildLateWakePlan(
  wakeMin: number | null,
  cfg: LateWakeConfig = DEFAULT_LATE_WAKE,
  opts?: { isWeekend?: boolean; isCollegeDay?: boolean }
): LateWakePlan | null {
  if (wakeMin == null) return null;
  if (opts?.isWeekend) return null;
  if (opts?.isCollegeDay === false) return null;

  const p1End = period1EndMin();
  const p1Start = period1StartMin();

  // Latest leave that still lands at/after P1 end (salvage window)
  const leaveForAfterP1 = p1End - cfg.busMinutes;
  // Leave needed to hit P1 start on time
  const leaveForOnTime = p1Start - cfg.busMinutes;

  if (wakeMin < cfg.onTimeUntilMin) {
    const leaveMin = Math.max(wakeMin + 55, leaveForOnTime); // normal morning block
    return {
      tier: 'on_time',
      wakeMin,
      title: pick([
        'On track — normal morning',
        'You woke on time. Run the full routine.',
        'Good. Do morning, then bus.',
      ]),
      body: `Wake ${minToHm(wakeMin)}. Leave around ${minToHm(leaveMin)} and you’ll hit Period 1 (${minToHm(p1Start)}). No shortcuts needed.`,
      leaveByHm: minToHm(leaveMin),
      arriveByHm: minToHm(leaveMin + cfg.busMinutes),
      routineAdvice: [
        'Full morning checklist (wash, hair, breakfast)',
        `Leave by ~${minToHm(leaveMin)}`,
        'Bus music as usual',
      ],
      suggestStatus: 'attended',
      severity: 'ok',
    };
  }

  if (wakeMin < cfg.lateOkUntilMin) {
    // Need leaveBy such that leaveBy >= wake + rush AND arrive ~ after P1
    const leaveBy = Math.max(wakeMin + cfg.rushMinutes, leaveForAfterP1 - 10);
    const arrive = leaveBy + cfg.busMinutes;
    const afterP1 = arrive >= p1End - 5;

    if (!afterP1 && leaveBy < wakeMin + 15) {
      // Edge: somehow can't make it — fall through to cooked messaging
    } else {
      return {
        tier: 'late_ok',
        wakeMin,
        title: pick([
          `Late wake (${minToHm(wakeMin)}) — join after Period 1`,
          'You’re late, but not dead. Skip fluff, catch after P1.',
          'Rush mode: after first period is the play.',
        ]),
        body: `Woke at ${minToHm(wakeMin)}. Don’t try for Period 1. Do the bare minimum, leave by ~${minToHm(leaveBy)}, land around ${minToHm(arrive)} — right after Period 1 ends (${minToHm(p1End)}). Mark left-early / late arrival if you want the log clean.`,
        leaveByHm: minToHm(leaveBy),
        arriveByHm: minToHm(arrive),
        routineAdvice: [
          'ONLY: brush + face + quick something to eat + bag/ID',
          'Skip long hair/serum/full breakfast if it costs the bus',
          `Leave by ${minToHm(leaveBy)} — no scrolling`,
          `Target: after Period 1 (${minToHm(p1End)})`,
        ],
        suggestStatus: 'left_early',
        severity: 'warn',
      };
    }
  }

  // Cooked
  const evenIfLeaveNow = wakeMin + 10 + cfg.busMinutes;
  return {
    tier: 'cooked',
    wakeMin,
    title: pick([
      `Woke ${minToHm(wakeMin)} — you’re cooked for college`,
      'Too late. Don’t force a pointless bus.',
      'College window closed. Stay home / bunk day.',
    ]),
    body: `Even if you walk out in 10 minutes you’d arrive ~${minToHm(evenIfLeaveNow)}. Period 1 is already gone and the bus isn’t worth half a day. Set today to bunk / didn’t go, use the extra time (spin, coding at home, rest). Tomorrow set the alarm earlier.`,
    leaveByHm: null,
    arriveByHm: null,
    routineAdvice: [
      'Do morning hygiene at home pace — no rush',
      'Set College status → Bunked / Didn’t go',
      'If coding day: stay home and code (college still skipped)',
      'Spin / free time is fair game after you eat',
    ],
    suggestStatus: 'bunked',
    severity: 'danger',
  };
}

/** Compact one-liner for banners */
export function lateWakeOneLiner(plan: LateWakePlan): string {
  if (plan.tier === 'on_time') return plan.title;
  if (plan.tier === 'late_ok')
    return `Late (${minToHm(plan.wakeMin)}) → leave ~${plan.leaveByHm}, after P1`;
  return `Cooked (woke ${minToHm(plan.wakeMin)}) — bunk / stay home`;
}
