/**
 * Home-arrival engine: welcome → delay → workout reminder / late cancel.
 * Pure orchestration over settings + workout repos. No fake background claims.
 */

import { workoutSessionsRepo, workoutTemplatesRepo } from '../data/repository';
import { toIsoDate } from '../routine/engine';
import type { HomeArrivalConfig } from './types';
import { playHomeSound } from './sound';
import { getSetting, setSetting } from '../data/settings';

const LATE_CANCEL_DATE_KEY = 'home.lateCancelAppliedDate';

/** Parse "HH:mm" into minutes since local midnight. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function nowLocalMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isAfterCutoff(cutoffHm: string, d = new Date()): boolean {
  return nowLocalMinutes(d) > hmToMinutes(cutoffHm);
}

/**
 * Late-arrival rule:
 * - If enabled and arrival is after lateArrivalCutoff
 * - Cancel today's scheduled/in-progress workout (not mark completed)
 * - Create a cancelled session if none exists
 * - Respect allowManualOverrideAfterLateCancel for later manual start
 */
export async function applyLateArrivalRule(
  config: HomeArrivalConfig,
  arrivalAt: Date = new Date()
): Promise<{ applied: boolean; reason: string }> {
  if (!config.lateArrivalRuleEnabled || !config.workoutAutomationEnabled) {
    return { applied: false, reason: 'Late-arrival rule or workout automation disabled' };
  }
  if (!isAfterCutoff(config.lateArrivalCutoff, arrivalAt)) {
    return { applied: false, reason: 'Arrived before cutoff' };
  }

  const iso = toIsoDate(arrivalAt);
  const already = await getSetting<string | null>(LATE_CANCEL_DATE_KEY, null);
  if (already === iso) {
    return { applied: false, reason: 'Already applied today' };
  }

  const sessions = await workoutSessionsRepo.list();
  const existing = sessions.find((s) => s.date === iso && !s.deleted);

  if (existing) {
    if (existing.status === 'completed') {
      return { applied: false, reason: 'Workout already completed — left alone' };
    }
    if (existing.status === 'cancelled') {
      await setSetting(LATE_CANCEL_DATE_KEY, iso);
      return { applied: false, reason: 'Already cancelled' };
    }
    await workoutSessionsRepo.update(existing.id, {
      status: 'cancelled',
      endedAt: arrivalAt.toISOString(),
      notes: [
        existing.notes,
        `Auto-cancelled: home arrival after ${config.lateArrivalCutoff}`,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  } else {
    const templates = await workoutTemplatesRepo.list();
    const dayIndex = arrivalAt.getDay();
    const tpl = templates.find((t) => t.enabled && !t.deleted && t.dayIndex === dayIndex);
    await workoutSessionsRepo.create({
      date: iso,
      templateId: tpl?.id,
      title: tpl?.name ?? 'Workout',
      focus: tpl?.focus ?? 'Auto',
      benefits: tpl?.benefits ?? [],
      status: 'cancelled',
      exercises: [],
      endedAt: arrivalAt.toISOString(),
      durationMinutes: 0,
      notes: `Auto-cancelled: home arrival after ${config.lateArrivalCutoff} (late-arrival rule)`,
    });
  }

  await setSetting(LATE_CANCEL_DATE_KEY, iso);
  return { applied: true, reason: `Cancelled workout — arrived after ${config.lateArrivalCutoff}` };
}

export interface ArrivalHandleResult {
  welcome: boolean;
  soundPlayed: boolean;
  lateCancel: { applied: boolean; reason: string };
  /** When workout reminder should surface (ISO), or null if late-cancel / automation off. */
  workoutPromptAt: string | null;
}

/**
 * Called when the engine detects enter-home (geofence or manual "I'm home").
 */
export async function handleHomeArrival(
  config: HomeArrivalConfig,
  opts?: { playSound?: boolean; arrivalAt?: Date }
): Promise<ArrivalHandleResult> {
  const arrivalAt = opts?.arrivalAt ?? new Date();
  const play = opts?.playSound !== false && config.homeSoundEnabled;

  if (play) {
    void playHomeSound(config.homeSoundId);
  }

  const lateCancel = await applyLateArrivalRule(config, arrivalAt);

  let workoutPromptAt: string | null = null;
  if (
    config.workoutAutomationEnabled &&
    !lateCancel.applied &&
    !(await isRestDayTemplate(arrivalAt))
  ) {
    const delayMs = Math.max(0, config.postArrivalDelayMinutes) * 60_000;
    workoutPromptAt = new Date(arrivalAt.getTime() + delayMs).toISOString();
  }

  return {
    welcome: true,
    soundPlayed: play,
    lateCancel,
    workoutPromptAt,
  };
}

async function isRestDayTemplate(d: Date): Promise<boolean> {
  const templates = await workoutTemplatesRepo.list();
  const tpl = templates.find((t) => t.enabled && !t.deleted && t.dayIndex === d.getDay());
  return tpl?.isRest === true;
}

/** Whether a workout reminder is still applicable right now. */
export async function isWorkoutStillApplicable(
  config: HomeArrivalConfig,
  d = new Date()
): Promise<boolean> {
  if (!config.workoutAutomationEnabled) return false;
  if (await isRestDayTemplate(d)) return false;

  const iso = toIsoDate(d);
  const sessions = await workoutSessionsRepo.list();
  const existing = sessions.find((s) => s.date === iso && !s.deleted);
  if (!existing) return true;
  if (existing.status === 'completed' || existing.status === 'cancelled') {
    if (
      existing.status === 'cancelled' &&
      config.allowManualOverrideAfterLateCancel
    ) {
      return true; // can still manual-start
    }
    return existing.status !== 'completed' && config.allowManualOverrideAfterLateCancel;
  }
  if (existing.status === 'skipped') return false;
  return existing.status === 'in_progress';
}
